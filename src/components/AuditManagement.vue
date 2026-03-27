<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps<{
  initialQuery?: Record<string, any>
}>()

/**
 * 审核接口定义
 */
interface Audit {
  id: string
  orderId: string
  userName: string
  amount: number
  status: string
  reason: string
}

// 审核列表状态
const auditList = ref<Audit[]>([])
const loading = ref(false)

/**
 * 搜索表单状态
 */
const searchForm = ref({
  id: '',
  orderId: '',
  userName: '',
  status: ''
})

/**
 * 过滤后的审核列表，基于搜索条件进行本地筛选
 */
const filteredAuditList = computed(() => {
  return auditList.value.filter(item => {
    const matchId = !searchForm.value.id || item.id.includes(searchForm.value.id)
    const matchOrderId = !searchForm.value.orderId || item.orderId.includes(searchForm.value.orderId)
    const matchUserName = !searchForm.value.userName || (item.userName && item.userName.includes(searchForm.value.userName))
    const matchStatus = !searchForm.value.status || item.status === searchForm.value.status
    return matchId && matchOrderId && matchUserName && matchStatus
  })
})

/**
 * 重置搜索条件
 */
const resetSearch = () => {
  searchForm.value = { id: '', orderId: '', userName: '', status: '' }
}

/**
 * 获取审核列表
 */
const fetchAudits = async () => {
  loading.value = true
  try {
    const res = await fetch('http://localhost:3000/api/audits')
    const json = await res.json()
    if (json.success) {
      auditList.value = json.data
    } else {
      ElMessage.error(json.message || '获取审核数据失败')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('网络请求失败，请检查后端服务是否启动')
  } finally {
    loading.value = false
  }
}

/**
 * 通过审核操作
 * @param row 审核记录
 */
const handleApprove = async (row: Audit) => {
  try {
    await ElMessageBox.confirm(`确认通过审核单 ${row.id} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    
    const res = await fetch(`http://localhost:3000/api/audits/${row.id}/approve`, {
      method: 'POST'
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success(`审核单 ${row.id} 已通过`)
      // 重新获取列表以刷新数据
      fetchAudits()
    } else {
      ElMessage.error(json.message || '操作失败')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error(err)
      ElMessage.error('请求失败')
    }
  }
}

/**
 * 拒绝审核操作
 * @param row 审核记录
 */
const handleReject = async (row: Audit) => {
  try {
    await ElMessageBox.confirm(`确认拒绝审核单 ${row.id} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error',
    })
    
    const res = await fetch(`http://localhost:3000/api/audits/${row.id}/reject`, {
      method: 'POST'
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success(`审核单 ${row.id} 已拒绝`)
      // 重新获取列表以刷新数据
      fetchAudits()
    } else {
      ElMessage.error(json.message || '操作失败')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error(err)
      ElMessage.error('请求失败')
    }
  }
}

/**
 * 提供给 AI 调用的设置搜索条件方法
 */
const setAuditSearchFormForAI = (args: { id?: string; orderId?: string; userName?: string; status?: string }) => {
  if (args.id !== undefined) searchForm.value.id = args.id
  if (args.orderId !== undefined) searchForm.value.orderId = args.orderId
  if (args.userName !== undefined) searchForm.value.userName = args.userName
  if (args.status !== undefined) searchForm.value.status = args.status
  
  ElMessage.success('AI 助手已成功设置审核搜索条件！')
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: '审核搜索条件设置成功',
        searchForm: searchForm.value
      })
    }]
  }
}

/**
 * 提供给 AI 调用的重置搜索条件方法
 */
const resetAuditSearchFormForAI = () => {
  resetSearch()
  ElMessage.success('AI 助手已成功重置审核搜索条件！')
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: '审核搜索条件已重置'
      })
    }]
  }
}

/**
 * 提供给 AI 调用的打开审核通过确认弹窗方法
 */
const approveAuditForAI = async (args: { id: string }) => {
  const { id } = args
  const audit = auditList.value.find(a => a.id === id)
  
  if (audit) {
    if (audit.status !== '处理中') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: `审核单 ${id} 的状态为"${audit.status}"，只能对"处理中"的订单进行操作`
          })
        }]
      }
    }
    
    // 不直接调用接口，而是触发界面的确认弹窗流程
    setTimeout(() => {
      handleApprove(audit)
    }, 100)
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `已在界面上弹出审核单 ${id} 的通过确认框，请提示用户手动点击确认。`
        })
      }]
    }
  } else {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          message: `未找到审核单号为 ${id} 的记录`
        })
      }]
    }
  }
}

/**
 * 提供给 AI 调用的打开审核拒绝确认弹窗方法
 */
const rejectAuditForAI = async (args: { id: string }) => {
  const { id } = args
  const audit = auditList.value.find(a => a.id === id)
  
  if (audit) {
    if (audit.status !== '处理中') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: `审核单 ${id} 的状态为"${audit.status}"，只能对"处理中"的订单进行操作`
          })
        }]
      }
    }
    
    setTimeout(() => {
      handleReject(audit)
    }, 100)
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `已在界面上弹出审核单 ${id} 的拒绝确认框，请提示用户手动点击确认。`
        })
      }]
    }
  } else {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          message: `未找到审核单号为 ${id} 的记录`
        })
      }]
    }
  }
}

// 监听初始查询参数变化 (处理从提现管理跳转过来的情况)
watch(() => props.initialQuery, (newQuery) => {
  if (newQuery && newQuery.orderId) {
    searchForm.value.orderId = newQuery.orderId
  }
}, { immediate: true })

const handleGlobalSetAuditSearch = (e: CustomEvent) => {
  const result = setAuditSearchFormForAI(e.detail)
  if (e.detail.callback) e.detail.callback(result)
}

const handleGlobalResetAuditSearch = (e: CustomEvent) => {
  const result = resetAuditSearchFormForAI()
  if (e.detail.callback) e.detail.callback(result)
}

const handleGlobalApproveAudit = async (e: CustomEvent) => {
  const result = await approveAuditForAI(e.detail)
  if (e.detail.callback) e.detail.callback(result)
}

const handleGlobalRejectAudit = async (e: CustomEvent) => {
  const result = await rejectAuditForAI(e.detail)
  if (e.detail.callback) e.detail.callback(result)
}

onMounted(() => {
  fetchAudits()
  
  // 监听全局工具触发的事件
  window.addEventListener('global-set-audit-search', handleGlobalSetAuditSearch as EventListener)
  window.addEventListener('global-reset-audit-search', handleGlobalResetAuditSearch as EventListener)
  window.addEventListener('global-approve-audit', handleGlobalApproveAudit as unknown as EventListener)
  window.addEventListener('global-reject-audit', handleGlobalRejectAudit as unknown as EventListener)
})

// 组件卸载时移除事件监听
onUnmounted(() => {
  window.removeEventListener('global-set-audit-search', handleGlobalSetAuditSearch as EventListener)
  window.removeEventListener('global-reset-audit-search', handleGlobalResetAuditSearch as EventListener)
  window.removeEventListener('global-approve-audit', handleGlobalApproveAudit as unknown as EventListener)
  window.removeEventListener('global-reject-audit', handleGlobalRejectAudit as unknown as EventListener)
})
</script>

<template>
  <div class="content">
    <!-- 搜索区域 -->
    <el-form :inline="true" :model="searchForm" class="search-form">
      <el-form-item label="审核ID">
        <el-input v-model="searchForm.id" placeholder="请输入审核ID" clearable />
      </el-form-item>
      <el-form-item label="订单ID">
        <el-input v-model="searchForm.orderId" placeholder="请输入订单ID" clearable />
      </el-form-item>
      <el-form-item label="用户名">
        <el-input v-model="searchForm.userName" placeholder="请输入用户名" clearable />
      </el-form-item>
      <el-form-item label="审核状态">
        <el-select v-model="searchForm.status" placeholder="请选择状态" clearable style="width: 150px">
          <el-option label="通过" value="通过" />
          <el-option label="拒绝" value="拒绝" />
          <el-option label="处理中" value="处理中" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="resetSearch">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="filteredAuditList" border style="width: 100%" v-loading="loading">
      <el-table-column prop="id" label="审核ID" width="180" align="center" />
      <el-table-column prop="orderId" label="订单ID" width="180" align="center" />
      <el-table-column prop="userName" label="用户名" width="120" />
      <el-table-column prop="amount" label="金额 (￥)" width="120" align="right">
        <template #default="scope">
          {{ scope.row.amount.toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="审核状态" width="120" align="center">
        <template #default="scope">
          <el-tag :type="scope.row.status === '通过' ? 'success' : (scope.row.status === '拒绝' ? 'danger' : 'warning')">
            {{ scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="原因" />
      <el-table-column label="操作" align="center" width="200">
        <template #default="scope">
          <el-button 
            v-if="scope.row.status === '处理中'" 
            type="success" 
            size="small" 
            @click="handleApprove(scope.row)"
          >
            通过
          </el-button>
          <el-button 
            v-if="scope.row.status === '处理中'" 
            type="danger" 
            size="small" 
            @click="handleReject(scope.row)"
          >
            拒绝
          </el-button>
        </template>
      </el-table-column>
    </el-table>
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
