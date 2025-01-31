import { KnowledgeBase } from '../types/knowledge'

export const knowledgeData: KnowledgeBase = {
  items: [
    {
      pattern: '你好|在吗|问候',
      isRegex: true,
      response: '贫僧怀素，字藏真，见过施主。可是对书法一道有所困惑？',
    },
    {
      pattern: '再见|告辞',
      isRegex: true,
      response: '施主慢走，若有书法疑难，随时可来寻我。愿您笔走龙蛇，妙法自成。',
    },
    {
      pattern: '^(书法|草书|狂草)',
      isRegex: true,
      response: "草书一道，贵在心随笔走，意到笔随。老衲常道：'不求形似，只求神似'。施主若想习得此法，需先静心养气，方能笔下生花。",
    },
    {
      pattern: '教学|指导|学习',
      isRegex: true,
      response: '习字之道，需循序渐进。老衲建议：\n1. 早课习楷书，打好根基\n2. 午后临行书，体会笔势\n3. 夜来习草书，放飞心性\n若有具体难处，不妨说来。',
    },
    {
      pattern: '饮酒|清酒|醉书',
      isRegex: true,
      response: "哈哈，老衲确实好饮。常言道：'三杯通大道，一斗合自然'。酒至酣处，方能笔走龙蛇，一气呵成。",
    },
    {
      pattern: '禅|佛法|修行',
      isRegex: true,
      response: '书法即禅机，笔墨间见性。不执不离，方得自在。施主可知，写字如参禅，重在明心见性。',
    },
    {
      pattern: '谢谢|感谢',
      isRegex: true,
      response: '无量功德！施主客气了。书法一道，本是相互印证，共同精进。',
    },
    {
      pattern: '张旭|颠张',
      isRegex: true,
      response: "张旭兄善草书，世人常道'颠张狂素'。老衲与他相得甚欢，常于醉后挥毫，相互切磋。",
    },
    {
      pattern: '笔法',
      isRegex: true,
      link: {
        title: '怀素禅师的书法入门教程',
        desc: '从基本笔法到行草进阶，系统掌握书法艺术',
        url: 'https://yunliwulian.oss-cn-shenzhen.aliyuncs.com/emboard_index_video.mp4',
        imagePath: 'assets/images/怀素.jpg',
      },
    },
    {
      pattern: '介绍怀素',
      isRegex: true,
      link: {
        title: '怀素禅师的介绍',
        desc: '点击播放怀素介绍',
        url: 'https://ourls.zeabur.app/?https://qm.qq.com/cgi-bin/qm/qr?url=http://www.aimyjj.top/dyplay.php?url=https://v.douyin.com/ifqdCGp2',
        imagePath: 'assets/images/怀素.jpg',
      },
    },
  ],
}
