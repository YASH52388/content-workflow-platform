const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [100, 'Client name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters'],
    default: ''
  },
  website: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  avatar: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'prospect'],
    default: 'active'
  },
  contractType: {
    type: String,
    enum: ['hourly', 'project', 'retainer', 'other'],
    default: 'project'
  },
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative'],
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentTerms: {
    type: String,
    enum: ['net15', 'net30', 'net45', 'net60', 'immediate', 'custom'],
    default: 'net30'
  },
  customPaymentTerms: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  socialMedia: {
    linkedin: { type: String, default: '' },
    twitter: { type: String, default: '' },
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' }
  },
  lastContact: {
    type: Date
  },
  nextFollowUp: {
    type: Date
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
clientSchema.index({ user: 1, status: 1 });
clientSchema.index({ user: 1, name: 1 });

// Virtual for full address
clientSchema.virtual('fullAddress').get(function() {
  const { street, city, state, zipCode, country } = this.address;
  return [street, city, state, zipCode, country].filter(Boolean).join(', ');
});

// Virtual for projects count (to be populated)
clientSchema.virtual('projectsCount', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'client',
  count: true
});

module.exports = mongoose.model('Client', clientSchema);

