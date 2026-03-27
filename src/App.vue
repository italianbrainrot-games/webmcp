<script setup lang="ts">
import { ref } from 'vue'
import { User, List, Check } from '@element-plus/icons-vue'
import UserManagement from './components/UserManagement.vue'
import WithdrawalManagement from './components/WithdrawalManagement.vue'
import AuditManagement from './components/AuditManagement.vue'
import { useGlobalWebMCP } from './composables/useGlobalWebMCP'

// 侧边栏当前选中的菜单
const activeMenu = ref('users')
// 跨组件传递的查询参数
const queryParams = ref<Record<string, any>>({})

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
