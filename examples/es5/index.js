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
  let y = -50;
  console.time('makeNodes');
  for (let i = 0; i < count; i++) {
    if (i % 10 === 0) {
      x = 100;
      y += 150;
    } else {
      x += 150;
    }
    const pen = {
      name: i % 2 === 0 ? 'rectangle' : 'circle',
      x,
      y,
      width: 100,
      height: 100,
      iconFamily: 't-icon',
      iconSize: 20,
      ellipsis: true,
      text: i + 1 + '',
      // textBackground: '#eeeeee',
      // textAlign: 'right',
      // textBaseline: 'bottom',
    };
    if (i % 7 === 1) {
      pen.text += '\n乐吾乐\nTopology';
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
        'M 497 569 H 173 c -39.7 0 -72 -32.3 -72 -72 V 173 C 101 133.3 133.3 101 173 101 h 324 c 39.7 0 72 32.3 72 72 v 324 c 0 39.7 -32.3 72 -72 72 z M 173 149 c -13.2 0 -24 10.8 -24 24 v 324 c 0 13.2 10.8 24 24 24 h 324 c 13.2 0 24 -10.8 24 -24 V 173 c 0 -13.2 -10.8 -24 -24 -24 H 173 z M 889 558 c -6.1 0 -12.3 -2.3 -17 -7 L 673 352 c -9.4 -9.4 -9.4 -24.6 0 -33.9 L 872 119 c 9.4 -9.4 24.6 -9.4 33.9 0 l 199 199 c 9.4 9.4 9.4 24.6 0 33.9 L 906 551 c -4.7 4.7 -10.9 7 -17 7 z M 723.9 335 L 889 500.1 L 1054.1 335 L 889 169.9 L 723.9 335 z M 1051 1123 H 727 c -39.7 0 -72 -32.3 -72 -72 V 727 c 0 -39.7 32.3 -72 72 -72 h 324 c 39.7 0 72 32.3 72 72 v 324 c 0 39.7 -32.3 72 -72 72 z M 727 703 c -13.2 0 -24 10.8 -24 24 v 324 c 0 13.2 10.8 24 24 24 h 324 c 13.2 0 24 -10.8 24 -24 V 727 c 0 -13.2 -10.8 -24 -24 -24 H 727 z M 497 1123 H 173 c -39.7 0 -72 -32.3 -72 -72 V 727 c 0 -39.7 32.3 -72 72 -72 h 324 c 39.7 0 72 32.3 72 72 v 324 c 0 39.7 -32.3 72 -72 72 z M 173 703 c -13.2 0 -24 10.8 -24 24 v 324 c 0 13.2 10.8 24 24 24 h 324 c 13.2 0 24 -10.8 24 -24 V 727 c 0 -13.2 -10.8 -24 -24 -24 H 173 z';
    }
    topology.addPen(pen, false);
  }
  console.timeEnd('makeNodes');
}
