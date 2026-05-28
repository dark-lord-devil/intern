import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src',
  plugins: [react()],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        login: resolve(__dirname, 'src/pages/login.html'),
        register: resolve(__dirname, 'src/pages/register.html'),
        otp: resolve(__dirname, 'src/pages/otp.html'),
        forgotPassword: resolve(__dirname, 'src/pages/forgot-password.html'),
        dashboard: resolve(__dirname, 'src/pages/dashboard.html'),
        wallet: resolve(__dirname, 'src/pages/wallet.html'),
        lending: resolve(__dirname, 'src/pages/lending.html'),
        investments: resolve(__dirname, 'src/pages/investments.html'),
        insurance: resolve(__dirname, 'src/pages/insurance.html'),
        earnhub: resolve(__dirname, 'src/pages/earnhub.html'),
        notifications: resolve(__dirname, 'src/pages/notifications.html'),
        security: resolve(__dirname, 'src/pages/security.html'),
        admin: resolve(__dirname, 'src/pages/admin.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});

