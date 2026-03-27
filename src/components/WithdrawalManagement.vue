<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits<{
  (e: 'navigate', path: string, query?: Record<string, any>): void
}>()

/**
 * 订单接口定义
 */
interface Order {
  id: string
  userId: number
  userName?: string
  amount: number
  status: string
  createTime: string
}

// 订单管理状态
const orderList = ref<Order[]>([])

/**
 * 补单弹窗相关状态
 */
const reorderDialogVisible = ref(false)
const reorderForm = ref({
  orderId: '',
  reason: ''
})

/**
 * 搜索表单状态
 */
const searchForm = ref({
  id: '',
  userName: '',
  status: ''
})

/**
 * 过滤后的订单列表，基于搜索条件进行本地筛选
 */
const filteredOrderList = computed(() => {
  return orderList.value.filter(item => {
    const matchId = !searchForm.value.id || item.id.includes(searchForm.value.id)
    const matchUserName = !searchForm.value.userName || (item.userName && item.userName.includes(searchForm.value.userName))
    const matchStatus = !searchForm.value.status || item.status === searchForm.value.status
    return matchId && matchUserName && matchStatus
  })
})

/**
 * 重置搜索条件
 */
const resetSearch = () => {
  searchForm.value = { id: '', userName: '', status: '' }
}

/**
 * 获取订单列表
 */
const fetchOrders = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/orders')
    const json = await res.json()
    if (json.success) {
      orderList.value = json.data
    } else {
      ElMessage.error('获取提现数据失败')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('网络请求失败，请检查后端服务是否启动')
  }
}

/**
 * 打开补单弹窗
 */
const handleReorder = (row: Order) => {
  reorderForm.value = {
    orderId: row.id,
    reason: ''
  }
  reorderDialogVisible.value = true
}

/**
 * 提交补单请求
 */
const submitReorder = async () => {
  if (!reorderForm.value.reason.trim()) {
    ElMessage.warning('请输入补单理由')
    return
  }
  
  try {
    const res = await fetch(`http://localhost:3000/api/orders/${reorderForm.value.orderId}/reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: reorderForm.value.reason })
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success(`提现单 ${reorderForm.value.orderId} 已重新提交，状态已更新为处理中`)
      reorderDialogVisible.value = false
      // 重新获取列表以刷新数据
      fetchOrders()
    } else {
      ElMessage.error(json.message || '操作失败')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('请求失败')
  }
}

/**
 * 跳转审核操作
 */
const handleAudit = (row: Order) => {
  ElMessage.info(`提现单 ${row.id} 跳转审核中...`)
  emit('navigate', 'audits', { orderId: row.id })
}

/**
 * 提供给 AI 调用的设置搜索条件方法
 * @param args 包含提现单号、用户名、提现状态的搜索参数对象
 */
const setSearchFormForAI = (args: { id?: string; userName?: string; status?: string }) => {
  if (args.id !== undefined) searchForm.value.id = args.id
  if (args.userName !== undefined) searchForm.value.userName = args.userName
  if (args.status !== undefined) searchForm.value.status = args.status
  
  ElMessage.success('AI 助手已成功设置搜索条件！')
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: '搜索条件设置成功',
        searchForm: searchForm.value
      })
    }]
  }
}

/**
 * 提供给 AI 调用的重置搜索条件方法
 */
const resetSearchFormForAI = () => {
  resetSearch()
  ElMessage.success('AI 助手已成功重置搜索条件！')
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: '搜索条件已重置'
      })
    }]
  }
}


const handleGlobalSetWithdrawalSearch = (e: CustomEvent) => {
  const result = setSearchFormForAI(e.detail)
  if (e.detail.callback) e.detail.callback(result)
}

const handleGlobalResetWithdrawalSearch = (e: CustomEvent) => {
  const result = resetSearchFormForAI()
  if (e.detail.callback) e.detail.callback(result)
}

onMounted(() => {
  fetchOrders()
  
  // 监听全局工具触发的事件
  window.addEventListener('global-set-withdrawal-search', handleGlobalSetWithdrawalSearch as EventListener)
  window.addEventListener('global-reset-withdrawal-search', handleGlobalResetWithdrawalSearch as EventListener)
  window.addEventListener('global-withdrawal-reordered', fetchOrders)
})

// 组件卸载时移除事件监听
onUnmounted(() => {
  window.removeEventListener('global-set-withdrawal-search', handleGlobalSetWithdrawalSearch as EventListener)
  window.removeEventListener('global-reset-withdrawal-search', handleGlobalResetWithdrawalSearch as EventListener)
  window.removeEventListener('global-withdrawal-reordered', fetchOrders)
})
</script>

<template>
  <div class="content">
    <!-- 搜索区域 -->
    <el-form :inline="true" :model="searchForm" class="search-form">
      <el-form-item label="提现单号">
        <el-input v-model="searchForm.id" placeholder="请输入提现单号" clearable />
      </el-form-item>
      <el-form-item label="用户名">
        <el-input v-model="searchForm.userName" placeholder="请输入用户名" clearable />
      </el-form-item>
      <el-form-item label="提现状态">
        <el-select v-model="searchForm.status" placeholder="请选择状态" clearable style="width: 150px">
          <el-option label="提现成功" value="提现成功" />
          <el-option label="提现失败" value="提现失败" />
          <el-option label="处理中" value="处理中" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="resetSearch">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="filteredOrderList" border style="width: 100%">
      <el-table-column prop="id" label="提现单号" width="180" align="center" />
      <el-table-column prop="userName" label="用户" width="120" />
      <el-table-column prop="createTime" label="创建时间" width="180" />
      <el-table-column prop="amount" label="金额 (￥)" width="120" align="right">
        <template #default="scope">
          {{ scope.row.amount.toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="提现状态" width="120" align="center">
        <template #default="scope">
          <el-tag :type="scope.row.status === '提现成功' ? 'success' : (scope.row.status === '提现失败' ? 'danger' : 'warning')">
            {{ scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center">
        <template #default="scope">
          <el-button v-if="scope.row.status === '提现失败'" type="warning" size="small" @click="handleReorder(scope.row)">
            补单
          </el-button>
          <el-button v-if="scope.row.status === '处理中'" type="primary" size="small" @click="handleAudit(scope.row)">
            跳转审核
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 补单弹窗 -->
    <el-dialog
      v-model="reorderDialogVisible"
      title="提现补单"
      width="400px"
    >
      <el-form :model="reorderForm" label-width="80px">
        <el-form-item label="提现单号">
          <el-input v-model="reorderForm.orderId" disabled />
        </el-form-item>
        <el-form-item label="补单理由" required>
          <el-input v-model="reorderForm.reason" type="textarea" :rows="3" placeholder="请输入补单理由" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="reorderDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitReorder">确认提交</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
}
.search-form {
  margin-bottom: 20px;
}
</style>
