import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectionOptions = {
  dbName: process.env.MONGODB_DATABASE || 'evoting',
  maxPoolSize: 10,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  authSource: 'admin',
};

const connectDB = async () => {
  const username = encodeURIComponent(process.env.MONGODB_USERNAME);
  const password = encodeURIComponent(process.env.MONGODB_PASSWORD);
  const cluster = process.env.MONGODB_CLUSTER;
  const appName = process.env.MONGODB_APPNAME || 'evoting-app';

  const mongoURI = `mongodb+srv://${username}:${password}@${cluster}/?retryWrites=true&w=majority&appName=${appName}`;

  mongoose.connection.on('connected', () => {
    console.log('✅ Connected to MongoDB Atlas');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
  });

  try {
    await mongoose.connect(mongoURI, connectionOptions);
  } catch (err) {
    console.error('❌ Initial connection failed:', err.message);
    setTimeout(connectDB, 5000);
  }

  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('🛑 MongoDB disconnected on app termination');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during disconnect:', err);
      process.exit(1);
    }
  });

  return mongoose.connection;
};

export default connectDB;
