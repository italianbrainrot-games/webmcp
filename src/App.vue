<script setup lang="ts">
import { ref } from 'vue'
import { User, List, Check } from '@element-plus/icons-vue'
import UserManagement from './components/UserManagement.vue'
import WithdrawalManagement from './components/WithdrawalManagement.vue'
import AuditManagement from './components/AuditManagement.vue'
import { useGlobalWebMCP } from './composables/useGlobalWebMCP'
import { sessionId } from './webmcp-client'
import { computed } from 'vue'

// 侧边栏当前选中的菜单
const activeMenu = ref('users')
// 跨组件传递的查询参数
const queryParams = ref<Record<string, any>>({})

// 动态生成遥控器 URL
const remoteUrl = computed(() => {
  // 判断是否为开发环境
  const isDev = import.meta.env.DEV;
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // 开发环境下使用 3002 端口（指向本地 Node 服务）
  // 生产环境下（如 Render），直接使用当前域名和端口
  const port = isDev ? ':3002' : (window.location.port ? `:${window.location.port}` : '');
  
  return `${protocol}//${hostname}${port}/remote.html?sessionId=${sessionId}&t=${Date.now()}`
})

// 使用免费 API 生成二维码
const qrCodeUrl = computed(() => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(remoteUrl.value)}`
})

/**
 * 处理导航事件
 * @param path 目标路径
 * @param query 传递的参数
 */
const handleNavigate = (path: string, query?: Record<string, any>) => {
  activeMenu.value = path
  if (query) {
    queryParams.value = query
  } else {
    queryParams.value = {}
  }
}

// 注册全局 WebMCP 工具
useGlobalWebMCP(activeMenu, handleNavigate)
</script>

<template>
  <el-container class="app-container">
    <el-aside width="200px" class="aside">
      <div class="logo">SaaS Demo</div>
      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical"
        @select="(index: string) => handleNavigate(index)" 
      >
        <el-menu-item index="users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="orders">
          <el-icon><List /></el-icon>
          <span>提现管理</span>
        </el-menu-item>
        <el-menu-item index="audits">
          <el-icon><Check /></el-icon>
          <span>审核管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ activeMenu === 'users' ? '用户管理系统' : (activeMenu === 'orders' ? '提现管理系统' : '审核管理系统') }}</div>
      </el-header>
      
      <el-main class="main-content">
        <el-card class="box-card">
          <!-- 用户管理视图 -->
          <UserManagement v-if="activeMenu === 'users'" />
          
          <!-- 提现管理视图 -->
          <WithdrawalManagement v-if="activeMenu === 'orders'" @navigate="handleNavigate" />
          
          <!-- 审核管理视图 -->
          <AuditManagement v-if="activeMenu === 'audits'" :initial-query="queryParams" />
        </el-card>
      </el-main>
    </el-container>

    <!-- 悬浮的扫码遥控区 -->
    <div class="remote-control-panel">
      <div class="panel-title">📱 手机扫码遥控</div>
      <img :src="qrCodeUrl" alt="QR Code" class="qr-code" />
      <div class="session-info">
        Session: <span>{{ sessionId }}</span>
      </div>
      <div class="tip">使用手机扫码，体验“一句话操作网页”</div>
    </div>
  </el-container>
</template>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  background-color: #f5f7fa;
}

.aside {
  background-color: #fff;
  border-right: solid 1px #e6e6e6;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  color: #409EFF;
  border-bottom: 1px solid #e6e6e6;
}

.remote-control-panel {
  position: fixed;
  bottom: 30px;
  right: 30px;
  background: white;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #e6e6e6;
  text-align: center;
  width: 180px;
  z-index: 1000;
}

.panel-title {
  font-weight: bold;
  margin-bottom: 10px;
  color: #333;
}

.qr-code {
  width: 150px;
  height: 150px;
  margin: 0 auto;
}

.session-info {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
}

.session-info span {
  color: #409EFF;
  font-weight: bold;
}

.tip {
  margin-top: 8px;
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.el-menu-vertical {
  border-right: none;
  flex: 1;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-title {
  font-size: 18px;
  font-weight: bold;
}

.main-content {
  padding: 20px;
}

.box-card {
  width: 100%;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
