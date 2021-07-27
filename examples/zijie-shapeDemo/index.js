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

function makeNodesAn() {
  topology.clear();
  topology.register(activityDiagram());
  // const count = +document.getElementById('count').value || 10000;
  const count = 5;
  let x = 100;
  let y = 100;
  // console.time('makeNodes');
  for (let i = 0; i < count; i++) {
    const pen = {
      name: 'message',
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
    if (i === 0) {
      pen.name = 'activityFinal';
    } else if (i === 1) {
      pen.name = 'forkV';
    } else if (i === 2) {
      pen.name = 'forkH';
    } else if (i === 3) {
      pen.name = 'swimlaneH';
    } else if (i === 4) {
      pen.name = 'swimlaneV';
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
