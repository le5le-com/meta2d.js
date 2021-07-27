
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
  topology.register(ftaPens());
  topology.register(iotPens());
  topology.register(classPens());
  topology.register(sequencePens());
  topology.register(flowPens());
  topology.registerDraw('votingGate',ftaPens().votingGateChartByCtx);
  topology.registerDraw('thermometer',iotPens().thermometerDrawScaleByCtx);
  topology.registerDraw('watermeter',iotPens().watermeterScaleByCtx);
  topology.registerDraw('lifeline',sequencePens().lifelineDashByCtx);
  const count = +document.getElementById('count').value || 10000;
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
    // if (i % 7 === 1) {
    //   pen.text = '乐吾乐\nTopology';
    // }
    // if (i % 3) {
    //   pen.image = 'btn.svg';
    // }
    // if (i % 5 === 1) {
    //   pen.icon = '\ue8e7';
    // }
    if (i % 100 === 1) {
      pen.name = 'rectangle';
    }
    if (i % 100 === 2) {
      pen.name = 'circle';
    }
    if (i % 100 === 3) {
      pen.name = 'svgPath';
      pen.path =
        'M397 469H73c-39.7 0-72-32.3-72-72V73C1 33.3 33.3 1 73 1h324c39.7 0 72 32.3 72 72v324c0 39.7-32.3 72-72 72zM73 49c-13.2 0-24 10.8-24 24v324c0 13.2 10.8 24 24 24h324c13.2 0 24-10.8 24-24V73c0-13.2-10.8-24-24-24H73zM789 458c-6.1 0-12.3-2.3-17-7L573 252c-9.4-9.4-9.4-24.6 0-33.9L772 19c9.4-9.4 24.6-9.4 33.9 0l199 199c9.4 9.4 9.4 24.6 0 33.9L806 451c-4.7 4.7-10.9 7-17 7zM623.9 235L789 400.1 954.1 235 789 69.9 623.9 235zM951 1023H627c-39.7 0-72-32.3-72-72V627c0-39.7 32.3-72 72-72h324c39.7 0 72 32.3 72 72v324c0 39.7-32.3 72-72 72zM627 603c-13.2 0-24 10.8-24 24v324c0 13.2 10.8 24 24 24h324c13.2 0 24-10.8 24-24V627c0-13.2-10.8-24-24-24H627zM397 1023H73c-39.7 0-72-32.3-72-72V627c0-39.7 32.3-72 72-72h324c39.7 0 72 32.3 72 72v324c0 39.7-32.3 72-72 72zM73 603c-13.2 0-24 10.8-24 24v324c0 13.2 10.8 24 24 24h324c13.2 0 24-10.8 24-24V627c0-13.2-10.8-24-24-24H73z';
    }
    if (i % 100 === 4) {
      pen.name = 'diamond';
    }
    if (i % 100 === 5) {
      pen.name = 'triangle';
    }
    if (i % 100 === 6) {
      pen.name = 'pentagon';
    }
    if (i % 100 === 7) {
      pen.name = 'pentagram';
    }
    if (i % 100 === 8) {
      pen.name = 'hexagon';
    }
    if (i % 100 === 9) {
      pen.name = 'leftArrow';
    }
    if (i % 100 === 10) {
      pen.name = 'rightArrow';
    }
    if (i % 100 === 11) {
      pen.name = 'twowayArrow';
      pen.width = 200;
    }
    if (i % 100 === 12) {
      pen.name = 'message';
    }
    if (i % 100 === 13) {
      pen.name = 'cloud';
    }
    if (i % 100 === 14) {
      pen.name = 'file';
      pen.height = 150;
    }
    if (i % 100 === 15) {
      pen.name = 'cube';
    }
    if (i % 100 === 16) {
      pen.name = 'people';
      pen.height = 150;

    }
    if (i % 100 === 17) {
      pen.name = 'line';
    }
    if (i % 100 === 18) {
      pen.name = 'mindLine';
    }
    if (i % 100 === 19) {
      pen.name = 'andGate';
      pen.height = 150;
    }
    if (i % 100 === 21) {
      pen.name = 'basicEvent';
      pen.height = 150;
    }
    if (i % 100 === 22) {
      pen.name = 'conditionalEvent';
      pen.width = 150;

    }    if (i % 100 === 23) {
      pen.name = 'event';
      pen.height = 150;
    }
    if (i % 100 === 23) {
      pen.name = 'forbiddenGate';
      pen.height = 150;
    }
    if (i % 100 === 24) {
      pen.name = 'orGate';
      pen.height = 150;
    }
    if (i % 100 === 25) {
      pen.name = 'priorityAndGate';
      pen.height = 150;
    }
    if (i % 100 === 26) {
      pen.name = 'switchEvent';
      pen.height = 150;
    }
    if (i % 100 === 27) {
      pen.name = 'transferSymbol';
      pen.height = 150;
    }
    if (i % 100 === 28) {
      pen.name = 'unexpandedEvent';
      pen.height = 150;
    }
    if (i % 100 === 29) {
      pen.name = 'votingGate';
      pen.height = 150;
    }if (i % 100 === 30) {
      pen.name = 'xorGate';
      pen.height = 150;
    }
    if (i % 100 === 31) {
      pen.name = 'airvalve';
      pen.data={
        isOpen :false
      }
      pen.height = 150;
    }
    if (i % 100 === 32) {
      pen.name = 'circular';
      pen.data ={
        value:0.25
      };
      pen.lineWidth= 5;
    }
    if (i % 100 === 33) {
      pen.name = 'coolingtowerfan';
    }  if (i % 100 === 34) {
      pen.name = 'electricvalve';
    }if (i % 100 === 35) {
      pen.name = 'elevatordoor';
    }
    if (i % 100 === 36) {
      pen.name = 'escalator';
      pen.data ={status: 'down'};
    }
    if (i % 100 === 37) {
      pen.name = 'fan';
      pen.data={rotate: 30};
    }
    if (i % 100 === 38) {
      pen.name = 'filter';
      pen.height = 150;
    }
    if (i % 100 === 39) {
      pen.name = 'pool';
      pen.data ={value:0.5};
    }
    if (i % 100 === 40) {
      pen.height = 30;
      pen.borderRadius = 10;
      pen.data ={value:0.75};
      pen.name = 'progress';
    }
    if (i % 100 === 41) {
      pen.width = 50;
      pen.height = 150;
      pen.name = 'thermometer';
      pen.data={
        value:10,
        thermometer:{
        Maximum: 20,
        Minimum: -20,
        criticalValue: 0,
      }};
    }
    if (i % 100 === 42) {
      pen.width = 300;
      pen.height = 300;
      pen.name = 'watermeter';
      pen.data={
        value:50,
        max:70,
        min:20,
        minText:'min',
        maxText:'max'
      }
    }
    if (i % 100 === 43) {
      pen.name = 'waterpumpbody';
    }
    if (i % 100 === 44) {
      pen.name = 'simpleClass';
      pen.height = 150;
      // pen.borderRadius = 0;
    }
    if (i % 100 === 45) {
      pen.name = 'interfaceClass';
      pen.height = 150;
      pen.borderRadius = 20;

    }
    if (i % 100 === 46) {
      pen.name = 'focus';
     pen.width =20,
     pen.height = 150;
    }
    if (i % 100 === 47) {
      pen.name = 'lifeline';
      pen.data= {
        headHight:50
      }
    }
    if (i % 100 === 48) {
      pen.name = 'comment';
    }
    if (i % 100 === 49) {
      pen.name = 'data';
    }
    if (i % 100 === 50) {
      pen.name = 'db';
    }
    if (i % 100 === 51) {
      pen.name = 'display';
    }
    if (i % 100 === 52) {
      pen.name = 'document';
    }
    if (i % 100 === 53) {
      pen.name = 'flowExternStorage';
    }
    if (i % 100 === 54) {
      pen.name = 'flowInternalStorage';
    }
    if (i % 100 === 55) {
      pen.name = 'flowManually';
    }
    if (i % 100 === 56) {
      pen.name = 'flowParallel';
    }
    if (i % 100 === 57) {
      pen.name = 'flowQueue';
    }
    if (i % 100 === 58) {
      pen.name = 'flowSubprocess';
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