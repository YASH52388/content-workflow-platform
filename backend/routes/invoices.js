const express = require('express');
const { body, query } = require('express-validator');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/invoices/stats/overview
// @desc    Get invoice statistics
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalInvoices = await Invoice.countDocuments({ user: req.user.id });
    const paidInvoices = await Invoice.countDocuments({ user: req.user.id, status: 'paid' });
    const pendingInvoices = await Invoice.countDocuments({ 
      user: req.user.id, 
      status: { $in: ['sent', 'viewed'] }
    });
    const overdueInvoices = await Invoice.countDocuments({
      user: req.user.id,
      status: { $in: ['sent', 'viewed'] },
      dueDate: { $lt: new Date() }
    });

    // Calculate total revenue
    const revenueResult = await Invoice.aggregate([
      { $match: { user: req.user._id, status: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Calculate pending amount
    const pendingResult = await Invoice.aggregate([
      { $match: { user: req.user._id, status: { $in: ['sent', 'viewed'] } } },
      { $group: { _id: null, pendingAmount: { $sum: '$total' } } }
    ]);
    const pendingAmount = pendingResult.length > 0 ? pendingResult[0].pendingAmount : 0;

    res.json({
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      totalRevenue,
      pendingAmount
    });
  } catch (error) {
    console.error('Get invoice stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/invoices
// @desc    Get all invoices for the authenticated user
// @access  Private
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status'),
  query('client').optional().isMongoId().withMessage('Invalid client ID'),
  query('search').optional().isLength({ max: 100 }).withMessage('Search term too long')
], validate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, client, search } = req.query;

    // Build query
    const query = { user: req.user.id };
    if (status) query.status = status;
    if (client) query.client = client;
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const invoices = await Invoice.find(query)
      .populate('client', 'name company email')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Invoice.countDocuments(query);

    res.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/invoices/:id
// @desc    Get invoice by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user.id
    })
      .populate('client', 'name company email phone address')
      .populate('project', 'title description')
      .populate('user', 'name email company phone address');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/invoices
// @desc    Create a new invoice
// @access  Private
router.post('/', auth, [
  body('client')
    .isMongoId()
    .withMessage('Valid client ID is required'),
  body('dueDate')
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one invoice item is required'),
  body('items.*.description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Item description is required and must not exceed 500 characters'),
  body('items.*.quantity')
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('items.*.rate')
    .isFloat({ min: 0 })
    .withMessage('Rate must be a positive number'),
  body('taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tax rate must be between 0 and 100'),
  body('discountRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount rate must be between 0 and 100')
], validate, async (req, res) => {
  try {
    // Verify client belongs to user
    const client = await Client.findOne({
      _id: req.body.client,
      user: req.user.id
    });

    if (!client) {
      return res.status(400).json({ message: 'Client not found or access denied' });
    }

    // Verify project belongs to user if provided
    if (req.body.project) {
      const project = await Project.findOne({
        _id: req.body.project,
        user: req.user.id
      });

      if (!project) {
        return res.status(400).json({ message: 'Project not found or access denied' });
      }
    }

    // Generate invoice number
    const invoiceNumber = await Invoice.generateInvoiceNumber(req.user.id);

    const invoiceData = {
      ...req.body,
      user: req.user.id,
      invoiceNumber
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    // Populate for response
    await invoice.populate([
      { path: 'client', select: 'name company email' },
      { path: 'project', select: 'title' }
    ]);

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/invoices/:id
// @desc    Update invoice
// @access  Private
router.put('/:id', auth, [
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('items')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one invoice item is required'),
  body('items.*.description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Item description must not exceed 500 characters'),
  body('items.*.quantity')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('items.*.rate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Rate must be a positive number'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'])
    .withMessage('Invalid status'),
  body('taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tax rate must be between 0 and 100'),
  body('discountRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount rate must be between 0 and 100')
], validate, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Don't allow editing paid invoices
    if (invoice.status === 'paid' && req.body.status !== 'paid') {
      return res.status(400).json({ message: 'Cannot modify paid invoice' });
    }

    Object.assign(invoice, req.body);
    await invoice.save();

    await invoice.populate([
      { path: 'client', select: 'name company email' },
      { path: 'project', select: 'title' }
    ]);

    res.json({
      message: 'Invoice updated successfully',
      invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/invoices/:id/send
// @desc    Send invoice to client
// @access  Private
router.post('/:id/send', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('client', 'name email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Cannot send paid invoice' });
    }

    // Update status and add to email history
    invoice.status = 'sent';
    invoice.emailHistory.push({
      sentTo: invoice.client.email,
      subject: `Invoice ${invoice.invoiceNumber}`,
      status: 'sent'
    });

    await invoice.save();

    // In a real application, you would send the actual email here
    // using a service like SendGrid, Mailgun, or AWS SES

    res.json({
      message: 'Invoice sent successfully',
      invoice
    });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/invoices/:id/mark-paid
// @desc    Mark invoice as paid
// @access  Private
router.put('/:id/mark-paid', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { 
        status: 'paid',
        paidDate: new Date()
      },
      { new: true }
    ).populate('client', 'name company email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({
      message: 'Invoice marked as paid',
      invoice
    });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/invoices/:id
// @desc    Delete invoice
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Cannot delete paid invoice' });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

