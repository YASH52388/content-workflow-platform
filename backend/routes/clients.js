const express = require('express');
const { body, query } = require('express-validator');
const Client = require('../models/Client');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/clients/stats/overview
// @desc    Get client statistics
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalClients = await Client.countDocuments({ user: req.user.id });
    const activeClients = await Client.countDocuments({ user: req.user.id, status: 'active' });
    const prospectClients = await Client.countDocuments({ user: req.user.id, status: 'prospect' });
    
    // Get new clients this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newClientsThisMonth = await Client.countDocuments({
      user: req.user.id,
      createdAt: { $gte: startOfMonth }
    });

    res.json({
      totalClients,
      activeClients,
      prospectClients,
      newClientsThisMonth
    });
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/clients
// @desc    Get all clients for the authenticated user
// @access  Private
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'prospect']).withMessage('Invalid status'),
  query('search').optional().isLength({ max: 100 }).withMessage('Search term too long')
], validate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, search } = req.query;

    // Build query
    const query = { user: req.user.id };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const clients = await Client.find(query)
      .populate('projectsCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Client.countDocuments(query);

    res.json({
      clients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/clients/:id
// @desc    Get client by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('projectsCount');

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Get recent projects for this client
    const recentProjects = await Project.find({
      client: client._id,
      user: req.user.id
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title status dueDate progress');

    res.json({
      client,
      recentProjects
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/clients
// @desc    Create a new client
// @access  Private
router.post('/', auth, [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must not exceed 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('company')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Please provide a valid website URL'),
  body('hourlyRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a positive number')
], validate, async (req, res) => {
  try {
    const clientData = {
      ...req.body,
      user: req.user.id
    };

    const client = new Client(clientData);
    await client.save();

    res.status(201).json({
      message: 'Client created successfully',
      client
    });
  } catch (error) {
    console.error('Create client error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Client with this email already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// @route   PUT /api/clients/:id
// @desc    Update client
// @access  Private
router.put('/:id', auth, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must not exceed 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('company')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Please provide a valid website URL'),
  body('hourlyRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be a positive number')
], validate, async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({
      message: 'Client updated successfully',
      client
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/clients/:id
// @desc    Delete client
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if client has active projects
    const activeProjects = await Project.countDocuments({
      client: req.params.id,
      user: req.user.id,
      status: { $in: ['planning', 'active', 'on-hold'] }
    });

    if (activeProjects > 0) {
      return res.status(400).json({
        message: 'Cannot delete client with active projects. Please complete or cancel projects first.'
      });
    }

    const client = await Client.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

