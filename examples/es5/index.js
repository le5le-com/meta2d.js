new Le5le.Topology('topology');

var stats = new Stats();
stats.showPanel(1); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

function animate() {
  stats.begin();

  // monitored code goes here

  stats.end();

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

function makeNodes() {
  topology.clear();

  const count = +document.getElementById('count').value || 10000;
  let x = 100;
  let y = 100;
  console.time('makeNodes');
  for (let i = 0; i < count; i++) {
    const pen = {
      name: i % 2 ? 'rectangle' : 'circle',
      x,
      y,
      width: 100,
      height: 100,
      iconFamily: 't-icon',
      iconSize: 20,
      ellipsis: true,
      // textBackground: '#eeeeee',
      // textAlign: 'right',
      // textBaseline: 'bottom',
    };
    if (i % 7 === 1) {
      pen.text = '乐吾乐\nTopology';
    }
    if (i % 3) {
      pen.image = 'btn.svg';
    }
    if (i % 5 === 1) {
      pen.icon = '\ue8e7';
    }

    if (i % 8 === 1) {
      pen.name = 'svgPath';
      pen.path =
        'M397 469H73c-39.7 0-72-32.3-72-72V73C1 33.3 33.3 1 73 1h324c39.7 0 72 32.3 72 72v324c0 39.7-32.3 72-72 72zM73 49c-13.2 0-24 10.8-24 24v324c0 13.2 10.8 24 24 24h324c13.2 0 24-10.8 24-24V73c0-13.2-10.8-24-24-24H73zM789 458c-6.1 0-12.3-2.3-17-7L573 252c-9.4-9.4-9.4-24.6 0-33.9L772 19c9.4-9.4 24.6-9.4 33.9 0l199 199c9.4 9.4 9.4 24.6 0 33.9L806 451c-4.7 4.7-10.9 7-17 7zM623.9 235L789 400.1 954.1 235 789 69.9 623.9 235zM951 1023H627c-39.7 0-72-32.3-72-72V627c0-39.7 32.3-72 72-72h324c39.7 0 72 32.3 72 72v324c0 39.7-32.3 72-72 72zM627 603c-13.2 0-24 10.8-24 24v324c0 13.2 10.8 24 24 24h324c13.2 0 24-10.8 24-24V627c0-13.2-10.8-24-24-24H627zM397 1023H73c-39.7 0-72-32.3-72-72V627c0-39.7 32.3-72 72-72h324c39.7 0 72 32.3 72 72v324c0 39.7-32.3 72-72 72zM73 603c-13.2 0-24 10.8-24 24v324c0 13.2 10.8 24 24 24h324c13.2 0 24-10.8 24-24V627c0-13.2-10.8-24-24-24H73z';
    }

    topology.addPen(pen, false);
    x += 150;
    if (i && i % 20 === 0) {
      x = 100;
      y += 150;
    }
  }
  console.timeEnd('makeNodes');
}
