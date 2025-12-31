const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { BCRYPT_ROUNDS } = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, 
    },

    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },

    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },

    
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'],
      unique: true,
    },

    
    biometricData: {
      faceEncoding: {
        type: String, 
        select: false, 
      },
      fingerprintHash: {
        type: String, 
        select: false,
      },
      lastVerified: {
        type: Date,
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
    },

    
    isActive: {
      type: Boolean,
      default: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    phoneVerificationOTP: {
      type: String,
      select: false,
    },

    phoneVerificationExpires: {
      type: Date,
      select: false,
    },

    
    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
    },

    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
    },

    
    refreshToken: {
      type: String,
      select: false,
    },

    
    profilePicture: {
      type: String, 
    },

    dateOfBirth: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },

    
    address: {
      houseNo: String,
      street: String,
      locality: String,
      city: {
        type: String,
        trim: true,
      },
      district: String,
      state: {
        type: String,
        enum: [
          'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
          'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
          'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
          'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
          'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
          'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
          'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
        ],
      },
      pincode: {
        type: String,
        match: [/^\d{6}$/, 'Please provide a valid 6-digit pincode'],
      },
      country: {
        type: String,
        default: 'India',
      },
    },

    
    kycStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'not_submitted'],
      default: 'not_submitted',
    },

    
    aadhaarNumber: {
      type: String,
      unique: true,
      sparse: true, 
      match: [/^\d{12}$/, 'Please provide a valid 12-digit Aadhaar number'],
      select: false, 
    },

    aadhaarVerified: {
      type: Boolean,
      default: false,
    },

    
    panNumber: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please provide a valid PAN number'],
      select: false, 
    },

    panVerified: {
      type: Boolean,
      default: false,
    },

    
    kycDocuments: [
      {
        type: {
          type: String,
          enum: ['aadhaar_card', 'pan_card', 'voter_id', 'driving_license', 'passport', 'bank_statement', 'utility_bill'],
        },
        documentNumber: String,
        url: String,
        uploadedAt: Date,
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        rejectionReason: String,
      },
    ],

    
    bankDetails: {
      accountHolderName: String,
      accountNumber: {
        type: String,
        select: false,
      },
      ifscCode: {
        type: String,
        uppercase: true,
        match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please provide a valid IFSC code'],
      },
      bankName: String,
      branch: String,
      upiId: {
        type: String,
        match: [/^[\w.-]+@[\w.-]+$/, 'Please provide a valid UPI ID'],
      },
    },

    
    lastLogin: {
      type: Date,
    },

    lastLoginIP: {
      type: String,
    },

    
    riskScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },

    
    preferences: {
      language: {
        type: String,
        enum: ['english', 'hindi', 'bengali', 'telugu', 'marathi', 'tamil', 'gujarati', 'urdu', 'kannada', 'odia', 'malayalam', 'punjabi'],
        default: 'english',
      },
      currency: {
        type: String,
        default: 'INR',
      },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: false },
      },
      twoFactorAuth: {
        enabled: { type: Boolean, default: false },
        method: {
          type: String,
          enum: ['sms', 'email', 'whatsapp'],
          default: 'sms',
        },
      },
    },
  },
  {
    timestamps: true, 
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});


userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});


userSchema.virtual('formattedPhoneNumber').get(function () {
  if (this.phoneNumber) {
    return `+91-${this.phoneNumber}`;
  }
  return null;
});



userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ aadhaarNumber: 1 }, { sparse: true });
userSchema.index({ panNumber: 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ kycStatus: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'address.state': 1 });
userSchema.index({ 'address.city': 1 });




userSchema.pre('save', async function (next) {
  
  if (!this.isModified('password')) {
    return next();
  }

  try {
    
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);

    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; 
    }

    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};


userSchema.methods.incLoginAttempts = async function () {
  
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  
  const updates = { $inc: { loginAttempts: 1 } };

  
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_TIME = 2 * 60 * 60 * 1000; 

  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return await this.updateOne(updates);
};


userSchema.methods.resetLoginAttempts = async function () {
  return await this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};


userSchema.methods.updateLastLogin = async function (ipAddress) {
  this.lastLogin = Date.now();
  this.lastLoginIP = ipAddress;
  await this.save({ validateBeforeSave: false });
};


userSchema.methods.requiresBiometricVerification = function () {
  if (!this.biometricData.isVerified) {
    return true;
  }

  
  const VERIFICATION_VALIDITY_DAYS = 30;
  const validityMs = VERIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

  if (this.biometricData.lastVerified) {
    const timeSinceVerification = Date.now() - this.biometricData.lastVerified.getTime();
    return timeSinceVerification > validityMs;
  }

  return true;
};


userSchema.methods.isKYCComplete = function () {
  return this.kycStatus === 'verified' && 
         (this.aadhaarVerified || this.panVerified);
};


userSchema.methods.maskSensitiveData = function (type) {
  if (type === 'aadhaar' && this.aadhaarNumber) {
    return `XXXX-XXXX-${this.aadhaarNumber.slice(-4)}`;
  }
  if (type === 'pan' && this.panNumber) {
    return `${this.panNumber.slice(0, 2)}XXX${this.panNumber.slice(-4)}`;
  }
  if (type === 'account' && this.bankDetails?.accountNumber) {
    return `XXXX${this.bankDetails.accountNumber.slice(-4)}`;
  }
  return null;
};


userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};


userSchema.statics.findByPhoneNumber = function (phoneNumber) {
  return this.findOne({ phoneNumber });
};


userSchema.statics.findActiveUsers = function () {
  return this.find({ isActive: true });
};


userSchema.statics.findByState = function (state) {
  return this.find({ 'address.state': state, isActive: true });
};


const User = mongoose.model('User', userSchema);

module.exports = User;
