// Simple logging utility to keep console clean and organized

class Logger {
    // Get current timestamp
    static timestamp() {
      return new Date().toISOString();
    }
    
    // Info messages (general information)
    static info(message) {
      console.log(`[${this.timestamp()}] ℹ️  ${message}`);
    }
    
    // Success messages (things working correctly)
    static success(message) {
      console.log(`[${this.timestamp()}] ✅ ${message}`);
    }
    
    // Error messages (something broke)
    static error(message, error = null) {
      console.error(`[${this.timestamp()}] ❌ ${message}`);
      if (error) {
        console.error(error);
      }
    }
    
    // Warning messages (not broken but concerning)
    static warn(message) {
      console.warn(`[${this.timestamp()}] ⚠️  ${message}`);
    }
    
    // Command usage logging
    static command(username, commandName) {
      console.log(`[${this.timestamp()}] 💬 ${username} used: ${commandName}`);
    }
  }
  
  module.exports = Logger;