// 添加 dialog 到 dom 中
const dialog = `
<div>
  <span>Le5le</span>
</div>
`;
const div = document.createElement('div');
div.className = 'test-dialog';
div.innerHTML = dialog;
document.body.appendChild(div);

// 监听消息
meta2d.on('showDialog', function (e) {
  // 原生 js 展示弹窗
  const div = document.getElementsByClassName('test-dialog')[0];
  div.style.display = 'block';
});
