const express = require('express');
const { body, query } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Client = require('../models/Client');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/projects/stats/overview
// @desc    Get project statistics
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments({ 
      user: req.user.id, 
      isArchived: false 
    });
    
    const activeProjects = await Project.countDocuments({ 
      user: req.user.id, 
      status: 'active',
      isArchived: false 
    });
    
    const completedProjects = await Project.countDocuments({ 
      user: req.user.id, 
      status: 'completed',
      isArchived: false 
    });
    
    const overdueProjects = await Project.countDocuments({
      user: req.user.id,
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { $lt: new Date() },
      isArchived: false
    });

    res.json({
      totalProjects,
      activeProjects,
      completedProjects,
      overdueProjects
    });
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects
// @desc    Get all projects for the authenticated user
// @access  Private
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['planning', 'active', 'on-hold', 'completed', 'cancelled']).withMessage('Invalid status'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  query('client').optional().isMongoId().withMessage('Invalid client ID'),
  query('search').optional().isLength({ max: 100 }).withMessage('Search term too long')
], validate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, priority, client, search } = req.query;

    // Build query
    const query = { user: req.user.id, isArchived: false };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (client) query.client = client;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(query)
      .populate('client', 'name company email')
      .populate('tasksCount')
      .populate('completedTasksCount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Project.countDocuments(query);

    res.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/projects/:id
// @desc    Get project by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      user: req.user.id
    })
      .populate('client', 'name company email phone')
      .populate('tasksCount')
      .populate('completedTasksCount');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get recent tasks for this project
    const recentTasks = await Task.find({
      project: project._id,
      user: req.user.id
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title status priority dueDate progress');

    res.json({
      project,
      recentTasks
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private
router.post('/', auth, [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must not exceed 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('client')
    .isMongoId()
    .withMessage('Valid client ID is required'),
  body('dueDate')
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('type')
    .optional()
    .isIn(['blog', 'social-media', 'video', 'podcast', 'newsletter', 'website', 'other'])
    .withMessage('Invalid project type'),
  body('budget.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget amount must be a positive number'),
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number')
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

    const projectData = {
      ...req.body,
      user: req.user.id
    };

    const project = new Project(projectData);
    await project.save();

    // Populate client data for response
    await project.populate('client', 'name company email');

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private
router.put('/:id', auth, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must not exceed 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('status')
    .optional()
    .isIn(['planning', 'active', 'on-hold', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  body('budget.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget amount must be a positive number'),
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number'),
  body('actualHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Actual hours must be a positive number')
], validate, async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    ).populate('client', 'name company email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if project has tasks
    const taskCount = await Task.countDocuments({
      project: req.params.id,
      user: req.user.id
    });

    if (taskCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete project with existing tasks. Please delete tasks first or archive the project.'
      });
    }

    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/projects/:id/archive
// @desc    Archive/unarchive project
// @access  Private
router.put('/:id/archive', auth, async (req, res) => {
  try {
    const { isArchived } = req.body;

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isArchived: Boolean(isArchived) },
      { new: true }
    ).populate('client', 'name company email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      message: `Project ${isArchived ? 'archived' : 'unarchived'} successfully`,
      project
    });
  } catch (error) {
    console.error('Archive project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

