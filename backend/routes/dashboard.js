const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/dashboard/overview
// @desc    Get dashboard overview data
// @access  Private
router.get('/overview', auth, async (req, res) => {
  try {
    // Get current date ranges
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Project statistics
    const projectStats = await Project.aggregate([
      { $match: { user: req.user._id, isArchived: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const projects = {
      total: await Project.countDocuments({ user: req.user.id, isArchived: false }),
      active: 0,
      completed: 0,
      planning: 0,
      onHold: 0
    };

    projectStats.forEach(stat => {
      if (stat._id === 'active') projects.active = stat.count;
      else if (stat._id === 'completed') projects.completed = stat.count;
      else if (stat._id === 'planning') projects.planning = stat.count;
      else if (stat._id === 'on-hold') projects.onHold = stat.count;
    });

    // Task statistics
    const taskStats = await Task.aggregate([
      { $match: { user: req.user._id, isArchived: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const tasks = {
      total: await Task.countDocuments({ user: req.user.id, isArchived: false }),
      todo: 0,
      inProgress: 0,
      review: 0,
      completed: 0
    };

    taskStats.forEach(stat => {
      if (stat._id === 'todo') tasks.todo = stat.count;
      else if (stat._id === 'in-progress') tasks.inProgress = stat.count;
      else if (stat._id === 'review') tasks.review = stat.count;
      else if (stat._id === 'completed') tasks.completed = stat.count;
    });

    // Overdue items
    const overdueProjects = await Project.countDocuments({
      user: req.user.id,
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { $lt: new Date() },
      isArchived: false
    });

    const overdueTasks = await Task.countDocuments({
      user: req.user.id,
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { $lt: new Date() },
      isArchived: false
    });

    // Client statistics
    const clientStats = {
      total: await Client.countDocuments({ user: req.user.id }),
      active: await Client.countDocuments({ user: req.user.id, status: 'active' }),
      newThisMonth: await Client.countDocuments({
        user: req.user.id,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      })
    };

    // Invoice statistics
    const invoiceStats = await Invoice.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      }
    ]);

    const invoices = {
      total: 0,
      paid: 0,
      pending: 0,
      overdue: 0,
      totalRevenue: 0,
      pendingAmount: 0
    };

    invoiceStats.forEach(stat => {
      invoices.total += stat.count;
      if (stat._id === 'paid') {
        invoices.paid = stat.count;
        invoices.totalRevenue = stat.totalAmount;
      } else if (['sent', 'viewed'].includes(stat._id)) {
        invoices.pending += stat.count;
        invoices.pendingAmount += stat.totalAmount;
      }
    });

    // Get overdue invoices
    invoices.overdue = await Invoice.countDocuments({
      user: req.user.id,
      status: { $in: ['sent', 'viewed'] },
      dueDate: { $lt: new Date() }
    });

    res.json({
      projects,
      tasks,
      clients: clientStats,
      invoices,
      overdue: {
        projects: overdueProjects,
        tasks: overdueTasks,
        invoices: invoices.overdue
      }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/recent-activity
// @desc    Get recent activity for dashboard
// @access  Private
router.get('/recent-activity', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get recent projects
    const recentProjects = await Project.find({
      user: req.user.id,
      isArchived: false
    })
      .populate('client', 'name company')
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title status dueDate progress client updatedAt');

    // Get recent tasks
    const recentTasks = await Task.find({
      user: req.user.id,
      isArchived: false
    })
      .populate('project', 'title')
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title status dueDate progress project updatedAt');

    // Get recent invoices
    const recentInvoices = await Invoice.find({
      user: req.user.id
    })
      .populate('client', 'name company')
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('invoiceNumber status total client updatedAt');

    // Combine and sort all activities
    const activities = [];

    recentProjects.forEach(project => {
      activities.push({
        type: 'project',
        id: project._id,
        title: project.title,
        status: project.status,
        client: project.client,
        dueDate: project.dueDate,
        progress: project.progress,
        updatedAt: project.updatedAt
      });
    });

    recentTasks.forEach(task => {
      activities.push({
        type: 'task',
        id: task._id,
        title: task.title,
        status: task.status,
        project: task.project,
        dueDate: task.dueDate,
        progress: task.progress,
        updatedAt: task.updatedAt
      });
    });

    recentInvoices.forEach(invoice => {
      activities.push({
        type: 'invoice',
        id: invoice._id,
        title: invoice.invoiceNumber,
        status: invoice.status,
        client: invoice.client,
        total: invoice.total,
        updatedAt: invoice.updatedAt
      });
    });

    // Sort by most recent and limit
    activities.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const limitedActivities = activities.slice(0, limit);

    res.json({ activities: limitedActivities });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/upcoming-deadlines
// @desc    Get upcoming deadlines
// @access  Private
router.get('/upcoming-deadlines', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const daysAhead = parseInt(req.query.days) || 7;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    // Get upcoming project deadlines
    const upcomingProjects = await Project.find({
      user: req.user.id,
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { $gte: new Date(), $lte: futureDate },
      isArchived: false
    })
      .populate('client', 'name company')
      .sort({ dueDate: 1 })
      .limit(limit)
      .select('title dueDate status priority client');

    // Get upcoming task deadlines
    const upcomingTasks = await Task.find({
      user: req.user.id,
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { $gte: new Date(), $lte: futureDate },
      isArchived: false
    })
      .populate('project', 'title client')
      .populate({
        path: 'project',
        populate: {
          path: 'client',
          select: 'name company'
        }
      })
      .sort({ dueDate: 1 })
      .limit(limit)
      .select('title dueDate status priority project');

    // Combine and sort deadlines
    const deadlines = [];

    upcomingProjects.forEach(project => {
      deadlines.push({
        type: 'project',
        id: project._id,
        title: project.title,
        dueDate: project.dueDate,
        status: project.status,
        priority: project.priority,
        client: project.client
      });
    });

    upcomingTasks.forEach(task => {
      deadlines.push({
        type: 'task',
        id: task._id,
        title: task.title,
        dueDate: task.dueDate,
        status: task.status,
        priority: task.priority,
        project: task.project,
        client: task.project?.client
      });
    });

    // Sort by due date
    deadlines.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const limitedDeadlines = deadlines.slice(0, limit);

    res.json({ deadlines: limitedDeadlines });
  } catch (error) {
    console.error('Get upcoming deadlines error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/productivity-stats
// @desc    Get productivity statistics
// @access  Private
router.get('/productivity-stats', auth, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    let startDate, endDate;
    const now = new Date();

    if (period === 'week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
      endDate = new Date();
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
    }

    // Tasks completed in period
    const tasksCompleted = await Task.countDocuments({
      user: req.user.id,
      status: 'completed',
      completedDate: { $gte: startDate, $lte: endDate }
    });

    // Projects completed in period
    const projectsCompleted = await Project.countDocuments({
      user: req.user.id,
      status: 'completed',
      completedDate: { $gte: startDate, $lte: endDate }
    });

    // Total hours logged
    const hoursResult = await Task.aggregate([
      {
        $match: {
          user: req.user._id,
          actualHours: { $gt: 0 },
          updatedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$actualHours' }
        }
      }
    ]);

    const totalHours = hoursResult.length > 0 ? hoursResult[0].totalHours : 0;

    // Revenue generated
    const revenueResult = await Invoice.aggregate([
      {
        $match: {
          user: req.user._id,
          status: 'paid',
          paidDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' }
        }
      }
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    res.json({
      period,
      tasksCompleted,
      projectsCompleted,
      totalHours,
      totalRevenue,
      averageHoursPerDay: totalHours / (period === 'week' ? 7 : period === 'month' ? 30 : 365)
    });
  } catch (error) {
    console.error('Get productivity stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

