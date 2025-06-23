const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    trim: true
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
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  issueDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  paidDate: {
    type: Date
  },
  currency: {
    type: String,
    default: 'USD',
    required: true
  },
  items: [{
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 1
    },
    rate: {
      type: Number,
      required: [true, 'Rate is required'],
      min: [0, 'Rate cannot be negative']
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative']
    },
    type: {
      type: String,
      enum: ['hourly', 'fixed', 'expense'],
      default: 'fixed'
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative'],
    default: 0
  },
  taxRate: {
    type: Number,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%'],
    default: 0
  },
  taxAmount: {
    type: Number,
    min: [0, 'Tax amount cannot be negative'],
    default: 0
  },
  discountRate: {
    type: Number,
    min: [0, 'Discount rate cannot be negative'],
    max: [100, 'Discount rate cannot exceed 100%'],
    default: 0
  },
  discountAmount: {
    type: Number,
    min: [0, 'Discount amount cannot be negative'],
    default: 0
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total cannot be negative'],
    default: 0
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: ''
  },
  terms: {
    type: String,
    maxlength: [1000, 'Terms cannot exceed 1000 characters'],
    default: ''
  },
  paymentMethod: {
    type: String,
    enum: ['bank-transfer', 'paypal', 'stripe', 'check', 'cash', 'other'],
    default: 'bank-transfer'
  },
  paymentDetails: {
    type: String,
    maxlength: [500, 'Payment details cannot exceed 500 characters'],
    default: ''
  },
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
  emailHistory: [{
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentTo: String,
    subject: String,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'opened', 'failed'],
      default: 'sent'
    }
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringSettings: {
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly']
    },
    interval: {
      type: Number,
      default: 1
    },
    endDate: Date,
    nextInvoiceDate: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
invoiceSchema.index({ user: 1, status: 1 });
invoiceSchema.index({ user: 1, client: 1 });
invoiceSchema.index({ user: 1, dueDate: 1 });
invoiceSchema.index({ invoiceNumber: 1 });

// Virtual to check if invoice is overdue
invoiceSchema.virtual('isOverdue').get(function() {
  return ['sent', 'viewed'].includes(this.status) && this.dueDate < new Date();
});

// Virtual for days until due
invoiceSchema.virtual('daysUntilDue').get(function() {
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to calculate totals
invoiceSchema.pre('save', function(next) {
  // Calculate item amounts
  this.items.forEach(item => {
    item.amount = item.quantity * item.rate;
  });
  
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
  
  // Calculate tax amount
  this.taxAmount = (this.subtotal * this.taxRate) / 100;
  
  // Calculate discount amount
  this.discountAmount = (this.subtotal * this.discountRate) / 100;
  
  // Calculate total
  this.total = this.subtotal + this.taxAmount - this.discountAmount;
  
  // Update paid date when status changes to paid
  if (this.isModified('status') && this.status === 'paid' && !this.paidDate) {
    this.paidDate = new Date();
  }
  
  next();
});

// Static method to generate invoice number
invoiceSchema.statics.generateInvoiceNumber = async function(userId) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  
  // Find the last invoice for this user in the current year
  const lastInvoice = await this.findOne({
    user: userId,
    invoiceNumber: { $regex: `^${prefix}` }
  }).sort({ invoiceNumber: -1 });
  
  let nextNumber = 1;
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

module.exports = mongoose.model('Invoice', invoiceSchema);

