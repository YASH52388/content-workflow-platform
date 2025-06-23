const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [200, 'Project title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
    default: ''
  },
  status: {
    type: String,
    enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  type: {
    type: String,
    enum: ['blog', 'social-media', 'video', 'podcast', 'newsletter', 'website', 'other'],
    default: 'other'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  completedDate: {
    type: Date
  },
  budget: {
    amount: {
      type: Number,
      min: [0, 'Budget amount cannot be negative'],
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
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
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    default: ''
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
projectSchema.index({ user: 1, status: 1 });
projectSchema.index({ user: 1, client: 1 });
projectSchema.index({ user: 1, dueDate: 1 });
projectSchema.index({ user: 1, priority: 1 });

// Virtual for tasks count
projectSchema.virtual('tasksCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'project',
  count: true
});

// Virtual for completed tasks count
projectSchema.virtual('completedTasksCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'project',
  match: { status: 'completed' },
  count: true
});

// Virtual to check if project is overdue
projectSchema.virtual('isOverdue').get(function() {
  return this.status !== 'completed' && this.dueDate < new Date();
});

// Virtual for days until due
projectSchema.virtual('daysUntilDue').get(function() {
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update progress based on completed tasks
projectSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('status')) {
    if (this.status === 'completed' && !this.completedDate) {
      this.completedDate = new Date();
      this.progress = 100;
    } else if (this.status !== 'completed' && this.completedDate) {
      this.completedDate = undefined;
    }
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);

