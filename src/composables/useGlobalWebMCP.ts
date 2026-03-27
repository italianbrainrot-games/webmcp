import { onMounted, onUnmounted, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 全局 WebMCP 工具注册 Hook
 * @param activeMenu 当前激活的菜单
 * @param handleNavigate 导航处理函数
 */
export function useGlobalWebMCP(
  activeMenu: Ref<string>,
  handleNavigate: (path: string, query?: Record<string, any>) => void
) {
  onMounted(() => {
    if (navigator.modelContext) {
      // 1. 注册全局导航工具
      navigator.modelContext.registerTool({
        name: 'navigate_to_page',
        description: '导航到指定的系统页面。支持的页面有：users(用户管理)、orders(提现管理)、audits(审核管理)。注意：跳转页面后，新页面的工具需要等页面加载完成后才可用。如果在跳转后需要执行新页面的工具，请在回复中提示用户，或者等待重新获取工具列表。',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'string',
              description: '目标页面的标识符。必须是以下之一：users, orders, audits',
              enum: ['users', 'orders', 'audits']
            },
            query: {
              type: 'object',
              description: '（可选）传递给目标页面的查询参数',
              additionalProperties: true
            }
          },
          required: ['page']
        },
        execute: async (args) => {
          const { page, query } = args as { page: string, query?: Record<string, any> }
          
          if (!['users', 'orders', 'audits'].includes(page)) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ success: false, message: `不支持的页面标识符: ${page}` })
              }]
            }
          }

          handleNavigate(page, query)
          
          // 等待一段时间让新组件挂载并注册它的工具
          await new Promise(resolve => setTimeout(resolve, 500))
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ 
                success: true, 
                message: `已成功导航到页面: ${page}。目标页面的工具已加载，你可以继续调用新页面的工具（如搜索、通过、拒绝等）了。` 
              })
            }]
          }
        }
      })

      // 2. 注册全局数据查询工具 (无 UI 依赖)
      navigator.modelContext.registerTool({
        name: 'global_get_user_list',
        description: '获取系统中所有的用户列表数据（无 UI 弹窗，仅返回数据）。',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        execute: async () => {
          try {
            const res = await fetch('/api/users')
            const json = await res.json()
            if (json.success) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ success: true, users: json.data })
                }]
              }
            }
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, message: '获取用户列表失败' }) }]
            }
          } catch (err: any) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, message: `接口请求失败: ${err.message}` }) }]
            }
          }
        }
      })
      
      // 3. 注册全局数据修改工具 (无 UI 依赖)
      navigator.modelContext.registerTool({
        name: 'global_update_user_info',
        description: '直接在后台更新用户资料（无 UI 弹窗，不需用户确认，仅后台更新）。',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: '需要修改的用户 ID' },
            name: { type: 'string', description: '用户新姓名' },
            phone: { type: 'string', description: '用户新电话' },
            address: { type: 'string', description: '用户新地址' }
          },
          required: ['id']
        },
        execute: async (args) => {
          const { id, name, phone, address } = args as any
          try {
            const res = await fetch(`/api/users/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, phone, address })
            })
            const json = await res.json()
            if (json.success) {
              ElMessage.success(`AI 助手已成功在后台更新用户 ${json.data.name || id} 的资料！`)
              // 触发一个自定义事件，通知可能正在显示用户的组件刷新数据
              window.dispatchEvent(new CustomEvent('global-user-updated', { detail: json.data }))
              return {
                content: [{ type: 'text', text: JSON.stringify({ success: true, message: '用户信息后台更新成功', user: json.data }) }]
              }
            }
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, message: json.message || `未找到 ID 为 ${id} 的用户` }) }]
            }
          } catch (err: any) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, message: `接口请求失败: ${err.message}` }) }]
            }
          }
        }
      })
      
      // 4. 提现管理：设置搜索条件
      navigator.modelContext.registerTool({
        name: 'setWithdrawalSearch',
        description: '设置提现管理界面的搜索条件，包括提现单号、用户名和提现状态',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '提现单号' },
            userName: { type: 'string', description: '用户名' },
            status: { type: 'string', description: '提现状态，可选值：提现成功、提现失败、处理中' }
          }
        },
        execute: async (args) => {
          if (activeMenu.value !== 'orders') {
            handleNavigate('orders')
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          return new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('global-set-withdrawal-search', {
              detail: { ...args as any, callback: resolve }
            }))
          })
        }
      })

      // 5. 提现管理：重置搜索条件
      navigator.modelContext.registerTool({
        name: 'resetWithdrawalSearch',
        description: '重置提现管理界面的所有搜索条件',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        execute: async () => {
          if (activeMenu.value !== 'orders') {
            handleNavigate('orders')
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          return new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('global-reset-withdrawal-search', {
              detail: { callback: resolve }
            }))
          })
        }
      })

      // 6. 提现管理：直接补单
      navigator.modelContext.registerTool({
        name: 'submitReorder',
        description: '直接为指定"提现失败"订单提交补单请求，并将订单状态更新为处理中，返回审核单号给 AI',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '提现单号（必填）' },
            reason: { type: 'string', description: '补单理由（必填）' }
          },
          required: ['id', 'reason']
        },
        execute: async (args) => {
          const { id, reason } = args as any
          
          try {
            const listRes = await fetch('/api/orders')
            const listJson = await listRes.json()
            if (!listJson.success) {
              return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: '获取订单列表失败' }) }] }
            }
            const order = listJson.data.find((o: any) => o.id === id)
            if (!order) {
              return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `未找到提现单号为 ${id} 的订单` }) }] }
            }
            if (order.status !== '提现失败') {
              return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `提现单 ${id} 的状态为"${order.status}"，只有"提现失败"的订单才能补单` }) }] }
            }
            
            const res = await fetch(`/api/orders/${id}/reorder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason })
            })
            const json = await res.json()
            
            if (json.success) {
              window.dispatchEvent(new CustomEvent('global-withdrawal-reordered'))
              const auditOrderId = `AUD-${id}`
              ElMessage.success(`AI 助手已为您补单成功，提现单 ${id} 状态已更新为处理中`)
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `补单成功！提现单 ${id} 已重新提交，状态已更新为"处理中"。对应的审核单号为: ${auditOrderId}。请将审核单号告诉用户。`,
                    orderId: id,
                    auditOrderId: auditOrderId
                  })
                }]
              }
            } else {
              return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: json.message || '操作失败' }) }] }
            }
          } catch (err: any) {
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `请求失败: ${err.message}` }) }] }
          }
        }
      })

      // 7. 审核管理：设置搜索条件
      navigator.modelContext.registerTool({
        name: 'setAuditSearch',
        description: '设置审核管理界面的搜索条件，包括审核ID、订单ID、用户名和审核状态',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '审核ID' },
            orderId: { type: 'string', description: '订单ID' },
            userName: { type: 'string', description: '用户名' },
            status: { type: 'string', description: '审核状态，可选值：通过、拒绝、处理中' }
          }
        },
        execute: async (args) => {
          if (activeMenu.value !== 'audits') {
            handleNavigate('audits')
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          return new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('global-set-audit-search', {
              detail: { ...args as any, callback: resolve }
            }))
          })
        }
      })

      // 8. 审核管理：重置搜索条件
      navigator.modelContext.registerTool({
        name: 'resetAuditSearch',
        description: '重置审核管理界面的所有搜索条件',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        execute: async () => {
          if (activeMenu.value !== 'audits') {
            handleNavigate('audits')
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          return new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('global-reset-audit-search', {
              detail: { callback: resolve }
            }))
          })
        }
      })

      // 9. 审核管理：通过审核
      navigator.modelContext.registerTool({
        name: 'approveAudit',
        description: '对指定"处理中"的审核单发起通过操作，会在界面弹出确认框，需要用户手动点击确认',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '审核单ID（必填）' }
          },
          required: ['id']
        },
        execute: async (args) => {
          if (activeMenu.value !== 'audits') {
            handleNavigate('audits')
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          return new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('global-approve-audit', {
              detail: { ...args as any, callback: resolve }
            }))
          })
        }
      })

      // 10. 审核管理：拒绝审核
      navigator.modelContext.registerTool({
        name: 'rejectAudit',
        description: '对指定"处理中"的审核单发起拒绝操作，会在界面弹出确认框，需要用户手动点击确认',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '审核单ID（必填）' }
          },
          required: ['id']
        },
        execute: async (args) => {
          if (activeMenu.value !== 'audits') {
            handleNavigate('audits')
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          return new Promise(resolve => {
            window.dispatchEvent(new CustomEvent('global-reject-audit', {
              detail: { ...args as any, callback: resolve }
            }))
          })
        }
      })

      // 11. 用户管理：创建提现订单
      navigator.modelContext.registerTool({
        name: 'global_create_withdrawal_order',
        description: '为指定用户创建一条随机金额（100-1000）的提现订单，并返回生成的订单ID给AI。',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'number', description: '用户ID（必填）' }
          },
          required: ['userId']
        },
        /**
         * 执行创建提现订单的操作
         * @param args 包含 userId 的参数对象
         * @returns 返回包含订单ID和结果信息的结果对象
         */
        execute: async (args) => {
          const { userId } = args as any
          try {
            const amount = Math.floor(Math.random() * 900) + 100
            const res = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, amount })
            })
            const json = await res.json()
            if (json.success) {
              ElMessage.success(`AI 助手已成功为用户 ID ${userId} 创建提现订单`)
              // 触发事件以更新可能存在的UI
              window.dispatchEvent(new CustomEvent('global-withdrawal-created'))
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `提现订单创建成功！生成的订单ID为: ${json.data.id}，金额为: ${amount}。请将订单ID告诉用户。`,
                    orderId: json.data.id,
                    amount: amount
                  })
                }]
              }
            } else {
              return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: json.message || '创建提现订单失败' }) }] }
            }
          } catch (err: any) {
            return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `请求失败: ${err.message}` }) }] }
          }
        }
      })
    }
  })

  onUnmounted(() => {
    // 如果需要清理全局工具注册，可以在这里处理
    // 注意：navigator.modelContext.unregisterTool() 尚未在标准中普及，具体看你使用的扩展是否支持
  })
}