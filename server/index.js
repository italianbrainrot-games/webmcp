import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const dataPath = path.join(__dirname, 'data', 'users.json');
const ordersDataPath = path.join(__dirname, 'data', 'orders.json');

// Helper function to read users
const readUsers = () => {
  try {
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users data:', err);
    return [];
  }
};

// Helper function to write users
const writeUsers = (users) => {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing users data:', err);
  }
};

// Helper function to read orders
const readOrders = () => {
  try {
    const data = fs.readFileSync(ordersDataPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading orders data:', err);
    return [];
  }
};

// Helper function to write orders
const writeOrders = (orders) => {
  try {
    fs.writeFileSync(ordersDataPath, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing orders data:', err);
  }
};

// GET /api/users
app.get('/api/users', (req, res) => {
  const users = readUsers();
  res.json({ success: true, data: users });
});

// PUT /api/users/:id
app.put('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const updatedData = req.body;
  
  const users = readUsers();
  const index = users.findIndex(u => u.id === id);
  
  if (index !== -1) {
    // Update existing user fields with new ones
    users[index] = { ...users[index], ...updatedData, id }; // ensure id doesn't change
    writeUsers(users);
    res.json({ success: true, message: '用户信息更新成功', data: users[index] });
  } else {
    res.status(404).json({ success: false, message: `未找到 ID 为 ${id} 的用户` });
  }
});

// GET /api/orders
app.get('/api/orders', (req, res) => {
  const orders = readOrders();
  const users = readUsers();
  
  // Attach user info to orders
  const ordersWithUserInfo = orders.map(order => {
    const user = users.find(u => u.id === order.userId);
    return {
      ...order,
      userName: user ? user.name : '未知用户'
    };
  });
  
  res.json({ success: true, data: ordersWithUserInfo });
});

// POST /api/orders
app.post('/api/orders', (req, res) => {
  const { userId, amount } = req.body;
  
  if (!userId || !amount) {
    return res.status(400).json({ success: false, message: '缺少 userId 或 amount' });
  }

  const orders = readOrders();
  
  // Generate a simple ID like 'WD' + timestamp
  const newOrder = {
    id: `WD${Date.now()}`,
    userId: parseInt(userId, 10),
    amount: parseFloat(amount),
    status: '处理中',
    createTime: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  };
  
  orders.push(newOrder);
  writeOrders(orders);
  
  const users = readUsers();
  const user = users.find(u => u.id === newOrder.userId);
  newOrder.userName = user ? user.name : '未知用户';
  
  res.json({ success: true, message: '模拟提现订单创建成功', data: newOrder });
});

// POST /api/orders/:id/reorder
app.post('/api/orders/:id/reorder', (req, res) => {
  const orderId = req.params.id;
  const reason = req.body.reason || '用户补单';
  const orders = readOrders();
  const index = orders.findIndex(o => o.id === orderId);
  
  if (index !== -1) {
    // Update existing order instead of generating a new one
    orders[index] = {
      ...orders[index],
      status: '处理中',
      createTime: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      reason: reason // 保存前端传过来的补单理由
    };
    
    writeOrders(orders);
    
    // Attach user info
    const users = readUsers();
    const user = users.find(u => u.id === orders[index].userId);
    orders[index].userName = user ? user.name : '未知用户';
    
    res.json({ success: true, message: '重新提现请求已提交', data: orders[index] });
  } else {
    res.status(404).json({ success: false, message: `未找到 ID 为 ${orderId} 的提现单` });
  }
});

// GET /api/audits
app.get('/api/audits', (req, res) => {
  const orders = readOrders();
  const users = readUsers();
  
  // 暂时使用提现单数据作为审核数据
  // 根据要求，“暂时的数据是审核在处理中的提现”，我们这里可以筛选或者直接映射全部。
  // 为了配合前端界面完整的状态展示，我们将所有提现单映射为审核记录
  const audits = orders.map(order => {
    const user = users.find(u => u.id === order.userId);
    let auditStatus = '处理中';
    if (order.status === '提现成功') auditStatus = '通过';
    if (order.status === '提现失败') auditStatus = '拒绝';
    
    // 如果订单本身有 reason（如补单时传入的），则使用订单的 reason，否则使用默认的逻辑
    let auditReason = order.reason;
    if (!auditReason) {
      auditReason = order.status === '提现失败' ? '账户异常' : '用户发起提现申请';
    }
    
    return {
      id: `AUD-${order.id}`,
      orderId: order.id,
      userName: user ? user.name : '未知用户',
      amount: order.amount,
      status: auditStatus,
      reason: auditReason
    };
  });
  
  // 如果需要仅展示处理中的数据，可以过滤: audits.filter(a => a.status === '处理中')
  res.json({ success: true, data: audits });
});

// POST /api/audits/:id/approve
app.post('/api/audits/:id/approve', (req, res) => {
  const auditId = req.params.id;
  const orderId = auditId.replace('AUD-', '');
  
  const orders = readOrders();
  const index = orders.findIndex(o => o.id === orderId);
  
  if (index !== -1) {
    orders[index].status = '提现成功';
    writeOrders(orders);
    
    res.json({ success: true, message: '审核已通过', data: { id: auditId, status: '通过' } });
  } else {
    res.status(404).json({ success: false, message: `未找到关联的订单 ${orderId}` });
  }
});

// POST /api/audits/:id/reject
app.post('/api/audits/:id/reject', (req, res) => {
  const auditId = req.params.id;
  const orderId = auditId.replace('AUD-', '');
  
  const orders = readOrders();
  const index = orders.findIndex(o => o.id === orderId);
  
  if (index !== -1) {
    orders[index].status = '提现失败';
    writeOrders(orders);
    
    res.json({ success: true, message: '审核已拒绝', data: { id: auditId, status: '拒绝' } });
  } else {
    res.status(404).json({ success: false, message: `未找到关联的订单 ${orderId}` });
  }
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
