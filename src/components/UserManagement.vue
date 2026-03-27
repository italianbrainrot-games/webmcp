<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 用户接口定义
 */
interface User {
  id: number
  name: string
  phone: string
  address: string
}

// 初始化用户数据为空数组
const userList = ref<User[]>([])

// 获取用户列表
const fetchUsers = async () => {
  try {
    const res = await fetch('/api/users')
    const json = await res.json()
    if (json.success) {
      userList.value = json.data
    } else {
      ElMessage.error('获取用户数据失败')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('网络请求失败，请检查后端服务是否启动')
  }
}

// 弹窗相关状态
const dialogVisible = ref(false)
const editingUser = ref<User>({
  id: 0,
  name: '',
  phone: '',
  address: ''
})

/**
 * 打开编辑弹窗
 * @param row 当前点击的用户数据行
 */
const handleEdit = (row: User) => {
  // 深拷贝数据，避免直接修改列表数据
  editingUser.value = { ...row }
  dialogVisible.value = true
}

/**
 * 保存用户修改
 */
const handleSave = async () => {
  if (!editingUser.value.name || !editingUser.value.phone || !editingUser.value.address) {
    ElMessage.warning('请填写完整的用户资料')
    return
  }
  
  try {
    const res = await fetch(`/api/users/${editingUser.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingUser.value.name,
        phone: editingUser.value.phone,
        address: editingUser.value.address
      })
    })
    const json = await res.json()
    if (json.success) {
      // 查找并更新列表中的数据
      const index = userList.value.findIndex(u => u.id === editingUser.value.id)
      if (index !== -1) {
        userList.value[index] = json.data
        ElMessage.success('用户资料修改成功')
        dialogVisible.value = false
      }
    } else {
      ElMessage.error(json.message || '保存失败')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('保存失败，网络请求异常')
  }
}

/**
 * 模拟创建一条提现订单
 * @param row 当前点击的用户数据行
 */
const handleCreateWithdrawal = async (row: User) => {
  try {
    const amount = Math.floor(Math.random() * 900) + 100 // 随机生成 100-1000 的金额
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: row.id,
        amount: amount
      })
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success(`成功为用户 ${row.name} 创建一条金额为 ${amount} 的提现订单`)
    } else {
      ElMessage.error(json.message || '创建提现订单失败')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('请求失败，网络异常')
  }
}

/**
 * =========================================
 * WebMCP 逻辑区域
 * =========================================
 */



/**
 * 提供给 AI 调用的预填修改资料弹窗方法
 * @param args 包含需要修改的用户 ID 及需要预填的字段
 */
const openEditDialogForAI = (args: { id: number, name?: string, phone?: string, address?: string }) => {
  const { id, name, phone, address } = args
  const user = userList.value.find(u => u.id === id)
  
  if (user) {
    // 1. 先用原始数据初始化表单并打开弹窗
    handleEdit(user)
    
    // 2. 如果 AI 传了新值，则覆盖表单中的对应字段（相当于帮用户输入）
    if (name !== undefined) editingUser.value.name = name
    if (phone !== undefined) editingUser.value.phone = phone
    if (address !== undefined) editingUser.value.address = address

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `已成功在界面上打开用户 ${user.name} 的修改弹窗，并预填了数据。请提示用户检查并在界面上手动点击“保存”确认。`
        })
      }]
    }
  } else {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          message: `未找到 ID 为 ${id} 的用户`
        })
      }]
    }
  }
}

// 组件挂载时注册 WebMCP 工具并获取数据
onMounted(() => {
  fetchUsers()

  if (navigator.modelContext) {
    // 监听全局数据更新事件，同步更新本地列表
    window.addEventListener('global-user-updated', (e: Event) => {
      const customEvent = e as CustomEvent
      const updatedUser = customEvent.detail
      const index = userList.value.findIndex(u => u.id === updatedUser.id)
      if (index !== -1) {
        userList.value[index] = updatedUser
      }
    })

    // 仅保留与当前 UI 强相关的工具
    navigator.modelContext.registerTool({
      name: 'open_user_edit_dialog',
      description: '【仅在用户管理页面可用】打开修改用户资料的界面弹窗，并可以预填新数据供用户确认。',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: '需要修改的用户 ID' },
          name: { type: 'string', description: '预填的新姓名' },
          phone: { type: 'string', description: '预填的新电话' },
          address: { type: 'string', description: '预填的新地址' }
        },
        required: ['id']
      },
      execute: async (args) => {
        return openEditDialogForAI(args as any)
      }
    })

    console.log('✅ WebMCP Tools 注册成功！')
  } else {
    console.warn('⚠️ 当前浏览器环境不支持 WebMCP (navigator.modelContext 未定义)')
  }
})

// 组件卸载时注销工具
onUnmounted(() => {
  if (navigator.modelContext && (navigator.modelContext as any).unregisterTool) {
    (navigator.modelContext as any).unregisterTool('open_user_edit_dialog')
  }
})

// 模拟 AI 调用的测试函数
// const simulateAICall = async () => {
//   if (!navigator.modelContext) {
//     ElMessage.error('当前环境不支持 WebMCP')
//     return
//   }
//   
//   ElMessage.info('AI 开始调用 global_update_user_info 工具...')
//   
//   try {
//     const testingApi = (navigator as any).modelContextTesting
//     
//     if (testingApi && testingApi.executeTool) {
//       const resultJson = await testingApi.executeTool(
//         'global_update_user_info', 
//         JSON.stringify({
//           id: 2,
//           name: 'AI 修改的李四',
//           address: '数字宇宙 001 号'
//         })
//       )
//       console.log('AI 调用结果:', JSON.parse(resultJson))
//       ElMessage.success('工具调用成功！请查看控制台')
//     } else {
//       console.warn('测试 API 不可用，请直接使用 WebMCP 扩展测试')
//     }
//   } catch (err: any) {
//     console.error('调用失败:', err)
//     ElMessage.error('调用失败: ' + err.message)
//   }
// }
</script>

<template>
  <div class="content">
    <div style="margin-bottom: 20px;">
      <!-- <el-button size="small" @click="simulateAICall">模拟 AI 调用</el-button> -->
    </div>
    <el-table :data="userList" border style="width: 100%">
      <el-table-column prop="id" label="ID" width="80" align="center" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号" width="150" />
      <el-table-column prop="address" label="住址" />
      <el-table-column label="操作" width="220" align="center">
        <template #default="scope">
          <el-button type="primary" size="small" @click="handleEdit(scope.row)">
            修改资料
          </el-button>
          <el-button type="success" size="small" @click="handleCreateWithdrawal(scope.row)">
            提现订单
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 修改资料弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="修改用户资料"
      width="500px"
    >
      <el-form :model="editingUser" label-width="80px">
        <el-form-item label="姓名" required>
          <el-input v-model="editingUser.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="editingUser.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="住址" required>
          <el-input v-model="editingUser.address" type="textarea" :rows="2" placeholder="请输入住址" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">保存</el-button>
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
</style>