const express = require('express');
const { body, query } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/tasks/stats/overview
// @desc    Get task statistics
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalTasks = await Task.countDocuments({ 
      user: req.user.id, 
      isArchived: false 
    });
    
    const todoTasks = await Task.countDocuments({ 
      user: req.user.id, 
      status: 'todo',
      isArchived: false 
    });
    
    const inProgressTasks = await Task.countDocuments({ 
      user: req.user.id, 
      status: 'in-progress',
      isArchived: false 
    });
    
    const completedTasks = await Task.countDocuments({ 
      user: req.user.id, 
      status: 'completed',
      isArchived: false 
    });
    
    const overdueTasks = await Task.countDocuments({
      user: req.user.id,
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { $lt: new Date() },
      isArchived: false
    });

    res.json({
      totalTasks,
      todoTasks,
      inProgressTasks,
      completedTasks,
      overdueTasks
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks
// @desc    Get all tasks for the authenticated user
// @access  Private
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['todo', 'in-progress', 'review', 'completed', 'cancelled']).withMessage('Invalid status'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  query('project').optional().isMongoId().withMessage('Invalid project ID'),
  query('assignedTo').optional().isMongoId().withMessage('Invalid user ID'),
  query('search').optional().isLength({ max: 100 }).withMessage('Search term too long')
], validate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, priority, project, assignedTo, search } = req.query;

    // Build query
    const query = { user: req.user.id, isArchived: false };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (project) query.project = project;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('project', 'title client')
      .populate('assignedTo', 'name email avatar')
      .populate({
        path: 'project',
        populate: {
          path: 'client',
          select: 'name company'
        }
      })
      .sort({ dueDate: 1, priority: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Task.countDocuments(query);

    res.json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get task by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user.id
    })
      .populate('project', 'title client dueDate')
      .populate('assignedTo', 'name email avatar')
      .populate('comments.author', 'name avatar')
      .populate({
        path: 'project',
        populate: {
          path: 'client',
          select: 'name company email'
        }
      });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private
router.post('/', auth, [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must not exceed 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('project')
    .isMongoId()
    .withMessage('Valid project ID is required'),
  body('dueDate')
    .isISO8601()
    .withMessage('Valid due date is required'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('type')
    .optional()
    .isIn(['research', 'writing', 'editing', 'design', 'review', 'publishing', 'other'])
    .withMessage('Invalid task type'),
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number')
], validate, async (req, res) => {
  try {
    // Verify project belongs to user
    const project = await Project.findOne({
      _id: req.body.project,
      user: req.user.id
    });

    if (!project) {
      return res.status(400).json({ message: 'Project not found or access denied' });
    }

    const taskData = {
      ...req.body,
      user: req.user.id,
      assignedTo: req.body.assignedTo || req.user.id
    };

    const task = new Task(taskData);
    await task.save();

    // Populate for response
    await task.populate([
      { path: 'project', select: 'title client' },
      { path: 'assignedTo', select: 'name email avatar' }
    ]);

    res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private
router.put('/:id', auth, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must not exceed 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
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
    .isIn(['todo', 'in-progress', 'review', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
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
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    )
      .populate('project', 'title client')
      .populate('assignedTo', 'name email avatar');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/comments
// @desc    Add comment to task
// @access  Private
router.post('/:id/comments', auth, [
  body('text')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment text is required and must not exceed 500 characters')
], validate, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = {
      text: req.body.text,
      author: req.user.id
    };

    task.comments.push(comment);
    await task.save();

    // Populate the new comment
    await task.populate('comments.author', 'name avatar');

    res.status(201).json({
      message: 'Comment added successfully',
      comment: task.comments[task.comments.length - 1]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:id/checklist
// @desc    Update task checklist
// @access  Private
router.put('/:id/checklist', auth, [
  body('checklist')
    .isArray()
    .withMessage('Checklist must be an array'),
  body('checklist.*.item')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Checklist item text is required')
], validate, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { checklist: req.body.checklist },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      message: 'Checklist updated successfully',
      checklist: task.checklist,
      checklistProgress: task.checklistProgress
    });
  } catch (error) {
    console.error('Update checklist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

