const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'review', 'completed', 'cancelled'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  type: {
    type: String,
    enum: ['research', 'writing', 'editing', 'design', 'review', 'publishing', 'other'],
    default: 'other'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  completedDate: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    min: [0, 'Estimated hours cannot be negative'],
    default: 0
  },
  actualHours: {
    type: Number,
    min: [0, 'Actual hours cannot be negative'],
    default: 0
  },
  progress: {
    type: Number,
    min: [0, 'Progress cannot be less than 0'],
    max: [100, 'Progress cannot exceed 100'],
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  checklist: [{
    item: {
      type: String,
      required: true,
      trim: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date
  }],
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    text: {
      type: String,
      required: true,
      maxlength: [500, 'Comment cannot exceed 500 characters']
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  dependencies: [{
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    type: {
      type: String,
      enum: ['blocks', 'blocked-by'],
      required: true
    }
  }],
  recurring: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      default: 'weekly'
    },
    interval: {
      type: Number,
      default: 1
    },
    endDate: Date
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
taskSchema.index({ user: 1, status: 1 });
taskSchema.index({ user: 1, project: 1 });
taskSchema.index({ user: 1, dueDate: 1 });
taskSchema.index({ user: 1, priority: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });

// Virtual to check if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  return this.status !== 'completed' && this.dueDate < new Date();
});

// Virtual for days until due
taskSchema.virtual('daysUntilDue').get(function() {
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for checklist completion percentage
taskSchema.virtual('checklistProgress').get(function() {
  if (!this.checklist || this.checklist.length === 0) return 0;
  const completed = this.checklist.filter(item => item.completed).length;
  return Math.round((completed / this.checklist.length) * 100);
});

// Pre-save middleware to update completion date and progress
taskSchema.pre('save', async function(next) {
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedDate) {
      this.completedDate = new Date();
      this.progress = 100;
    } else if (this.status !== 'completed' && this.completedDate) {
      this.completedDate = undefined;
    }
  }
  
  // Update checklist item completion dates
  if (this.isModified('checklist')) {
    this.checklist.forEach(item => {
      if (item.completed && !item.completedAt) {
        item.completedAt = new Date();
      } else if (!item.completed && item.completedAt) {
        item.completedAt = undefined;
      }
    });
  }
  
  next();
});

module.exports = mongoose.model('Task', taskSchema);

