import mongoose from 'mongoose';
import crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  keeperhubApiKey: { type: String, required: false },
  openrouterApiKey: { type: String, required: false },
  walletAddress: { type: String, required: false },
  discordWebhookUrl: { type: String, required: false },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.statics.hashPassword = hashPassword;

UserSchema.methods.verifyPassword = function (password: string): boolean {
  return this.passwordHash === hashPassword(password);
};

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export { hashPassword };
