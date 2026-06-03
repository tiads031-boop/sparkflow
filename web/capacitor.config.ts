import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'work.mindd.sparkflow',
  appName: 'Sparkflow',
  webDir: 'dist',
  server: {
    // 生产模式用打包后的静态文件
    androidScheme: 'https',
    // 开发时可配置为你的 API 地址（取消注释下面两行）
    // url: 'http://192.168.x.x:5173',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
