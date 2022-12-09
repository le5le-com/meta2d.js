import { EventAction } from '@meta2d/core';

/*
 * @Description:
 * @Author: G
 * @Date: 2021-10-13 11:23:17
 * @LastEditTime: 2021-10-13 11:24:26
 */
export const icons = [
  {
    key: 'rect',
    title: '矩形',
    data: {
      name: 'rectangle',
      text: '矩形',
      width: 100,
      height: 100,
      title: '# 矩形',
    },
  },
  {
    key: 'circle',
    title: '圆形',
    data: {
      name: 'circle',
      text: 'le5le',
      width: 100,
      height: 100,
      events: [
        {
          name: 'click',
          action: EventAction.Emit, // 执行动作
          value: 'showDialog',
        },
      ],
    },
  },
  {
    key: 'img',
    title: '图片',
    data: {
      name: 'image',
      width: 100,
      height: 100,
      image:
        'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fimg.zcool.cn%2Fcommunity%2F016ba9554b952b000001bf72fa6574.jpg%402o.jpg&refer=http%3A%2F%2Fimg.zcool.cn&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=jpeg?sec=1636344024&t=f977b8ad47acf62ee3579d594f32489a',
    },
  },
  {
    key: 'video',
    title: '视频',
    data: {
      name: 'video',
      width: 100,
      height: 100,
      video: 'http://clips.vorwaerts-gmbh.de/big_buck_bunny.mp4',
      autoPlay: true,
    },
  },
  {
    key: 'audio',
    title: '音频',
    data: {
      name: 'video',
      width: 100,
      height: 100,
      audio: 'https://down.ear0.com:3321/preview?soundid=37418&type=mp3',
      autoPlay: true,
    },
  },
  {
    // 该图形能拖入画布，说明注册成功
    key: 'pentagram',
    title: '企业图形库',
    data: {
      name: 'atlassian.away',
      width: 100,
      height: 100,
    },
  },
  {
    key: 'pentagram',
    title: '图表',
    data: {
      name: 'echarts',
      width: 400,
      height: 300,
      externElement: true,
      disableAnchor: true,
      echarts: {
        option: {
          xAxis: {
            type: 'category',
            data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              data: [820, 932, 901, 934, 1290, 1330, 1320],
              type: 'line',
            },
          ],
        },
      },
    },
  },
];
