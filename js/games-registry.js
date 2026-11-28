/**
 * 游戏注册表（全站游戏入口的唯一数据源）
 * 新增游戏：1) games/ 下建文件夹放 index.html；2) 下方数组加一条配置。
 * 主页自动读取本文件生成卡片。排序规则：最新上线的排最前（order 越小越靠前）。
 */
(function (global) {
  'use strict';

  var GAMES = [
    /* ===== 原创力作（最新上线，10 款） ===== */
    {
      id: 'color-awaken', title: '色彩唤醒',
      desc: '给失去颜色的画上色，涂对原来的颜色，花朵绽放、蝴蝶飞舞、星星眨眼，整幅画慢慢"活"过来。',
      icon: '🎨', color: '#FF8FB1', path: 'games/color-awaken/index.html',
      tags: ['填色解压', '生命反馈', '治愈'], order: 1
    },
    {
      id: 'echo-valley', title: '回声山谷',
      desc: '点击发出一圈声波，碰到岩壁会反射。调整方向让它绕着撞到沉睡的小动物，把它们一一唤醒。',
      icon: '🔊', color: '#4DA8FF', path: 'games/echo-valley/index.html',
      tags: ['声波反射', '解谜', '治愈光效'], order: 2
    },
    {
      id: 'water-drop', title: '水滴旅行',
      desc: '上下滑动倾斜荷叶，露珠受重力滚动。收集够小露珠，把它稳稳送进右端水潭，别让它掉下去。',
      icon: '💧', color: '#5FD8A4', path: 'games/water-drop/index.html',
      tags: ['重力物理', '倾斜操控', '晶莹'], order: 3
    },
    {
      id: 'breath-bubble', title: '呼吸泡泡',
      desc: '按住吸气泡泡变大，松开呼气缓缓上升。跟着呼吸节奏，让泡泡稳稳穿过光环，真正的深呼吸放松。',
      icon: '☁️', color: '#B77BFF', path: 'games/breath-bubble/index.html',
      tags: ['呼吸节奏', '冥想治愈', '极简'], order: 4
    },
    {
      id: 'star-web', title: '织网接星',
      desc: '点两个节点拉出有长度限制的丝线，像蜘蛛一样织出承托网，把掉落的星星弹进收集筐。',
      icon: '🕸️', color: '#C79BFF', path: 'games/star-web/index.html',
      tags: ['连线建造', '物理承接', '夜空'], order: 5
    },
    {
      id: 'gear-beauty', title: '齿轮之美',
      desc: '把散落的齿轮拖到轴上，尺寸吻合就"咔哒"咬合联动。让整台机械咔咔转起来，机械美感十足。',
      icon: '⚙️', color: '#FF9E5E', path: 'games/gear-beauty/index.html',
      tags: ['拼合联动', '机械美学', '满足感'], order: 6
    },
    {
      id: 'seed-diary', title: '种子日记',
      desc: '看提示给种子阳光、清水和肥料，赶走来偷吃的小虫子。耐心照顾，看它发芽长叶，最后开出美丽的花。',
      icon: '🌱', color: '#5FD8A4', path: 'games/seed-diary/index.html',
      tags: ['养成', '成长动画', '治愈'], order: 7
    },
    {
      id: 'hand-shadow', title: '手影剧场',
      desc: '一盏灯一面墙，照着虚线用手指摆出兔子、小鸟、小鹿的手影，相似度越高越好，演完一整场手影戏。',
      icon: '✋', color: '#E0A93B', path: 'games/hand-shadow/index.html',
      tags: ['多点触控', '手影', '新颖'], order: 8
    },
    {
      id: 'snow-guardian', title: '雪花守护者',
      desc: '指尖周围形成暖区托住飘落的雪花，带着它缓缓移到花苞上。雪白的冬日氛围，连续守护的治愈手感。',
      icon: '❄️', color: '#8FD3FF', path: 'games/snow-guardian/index.html',
      tags: ['守护手感', '治愈', '冬日'], order: 9
    },
    {
      id: 'chameleon-master', title: '变色龙大师',
      desc: '背景颜色不断变化，天敌小鸟逼近！快速点对应色块让变色龙变成同色躲过搜捕，连对连击加分。',
      icon: '🦎', color: '#FF6FA8', path: 'games/chameleon-master/index.html',
      tags: ['反应', '色彩', '视觉盛宴'], order: 10
    },

    /* ===== 创意新游（10 款） ===== */
    {
      id: 'bubble-merge', title: '泡泡合成大作战',
      desc: '瞄准射出泡泡，同色相连即消除，合并升级的大泡泡爆破还有十字连锁，一次清一大片。',
      icon: '🧼', color: '#FF5B7C', path: 'games/bubble-merge/index.html',
      tags: ['合成', '连锁爆破', '上头'], order: 11
    },
    {
      id: 'fruit-slice', title: '水果切切乐',
      desc: '划动切水果，还要按提示的颜色顺序切！切对连击加分，切错扣分，冰冻水果碰不得。',
      icon: '🍉', color: '#4DD6A0', path: 'games/fruit-slice/index.html',
      tags: ['反应', '顺序策略', '爽快'], order: 12
    },
    {
      id: 'guard-garden', title: '守卫菜园',
      desc: '打跑偷菜的动物：地鼠、兔子、金鼠分值不同，别误打稻草人。连击攒满触发金锤暴击。',
      icon: '🐹', color: '#7FD48A', path: 'games/guard-garden/index.html',
      tags: ['反应', '角色区分', '暴击'], order: 13
    },
    {
      id: 'element-2048', title: '元素进化2048',
      desc: '滑动合并相同元素，水滴→溪流→湖泊→大海→云朵→天空→彩虹，合出彩虹即通关。',
      icon: '💧', color: '#4DA8FF', path: 'games/element-2048/index.html',
      tags: ['益智', '数字进化', '目标'], order: 14
    },
    {
      id: 'fruit-slingshot', title: '弹射水果砸瓶',
      desc: '拖动弹弓发射水果，砸倒堆叠的瓶子。物理崩塌手感，一发多杀有奖励，关卡递增。',
      icon: '🍎', color: '#87CEEB', path: 'games/fruit-slingshot/index.html',
      tags: ['物理', '弹射', '闯关'], order: 15
    },
    {
      id: 'neon-blocks', title: '霓虹方块',
      desc: '经典方块升级版：彩虹方块万能匹配，炸弹方块清一片。霓虹发光画风，消行更爽快。',
      icon: '🌈', color: '#6A8DFB', path: 'games/neon-blocks/index.html',
      tags: ['经典', '道具方块', '霓虹'], order: 16
    },
    {
      id: 'memory-flip', title: '记忆翻翻乐',
      desc: '翻开两张相同卡片配对，连续配对有连击加成，但别翻到炸弹。60秒内配完8组通关。',
      icon: '🎴', color: '#B77BFF', path: 'games/memory-flip/index.html',
      tags: ['记忆', '限时', '连击'], order: 17
    },
    {
      id: 'gold-miner', title: '黄金矿工寻宝',
      desc: '放下钩爪抓宝藏：钻石值钱、石头不值钱、炸弹扣钱、福袋有惊喜，达到目标金币过关。',
      icon: '💰', color: '#FFD84A', path: 'games/gold-miner/index.html',
      tags: ['策略', '随机奖励', '闯关'], order: 18
    },
    {
      id: 'cloud-bunny', title: '云端跳跳兔',
      desc: '小兔子自动向前跑，点击跳跃躲开障碍、收集胡萝卜。跑得越远越快，看你能跑多远。',
      icon: '🐰', color: '#7CBF5E', path: 'games/cloud-bunny/index.html',
      tags: ['跑酷', '收集', '视差'], order: 19
    },
    {
      id: 'slide-puzzle', title: '滑块拼图',
      desc: '点击空位旁的图块，把打乱的图案拼回原样。3×3滑块，步数少、用时短能拿高评级。',
      icon: '🧩', color: '#FF9E4A', path: 'games/slide-puzzle/index.html',
      tags: ['益智', '拼图', '评级'], order: 20
    },

    /* ===== 人气爆款（5 款） ===== */
    {
      id: 'jump', title: '跳一跳',
      desc: '按住蓄力松开起跳，稳稳落在方块上。越靠近中心分越高，连击不断分数翻倍，考验手感的爆款玩法。',
      icon: '🟦', color: '#6A8DFB', path: 'games/jump/index.html',
      tags: ['爆款', '蓄力节奏', '连击'], order: 21
    },
    {
      id: 'suika', title: '合成大西瓜',
      desc: '按住滑动瞄准、松手投放水果，两个相同水果碰撞就合成更大的。一路合到大西瓜，千万别堆过警戒线！',
      icon: '🍉', color: '#F0852A', path: 'games/suika/index.html',
      tags: ['爆款', '物理合成', '上头'], order: 22
    },
    {
      id: 'match3', title: '羊了个羊',
      desc: '点击上层图案放进七格槽位，集齐三个相同自动消除。被压住的不能点，槽位满了就输，策略十足。',
      icon: '🐑', color: '#37C9A8', path: 'games/match3/index.html',
      tags: ['爆款', '三消策略', '烧脑'], order: 23
    },
    {
      id: 'snake', title: '贪吃蛇大作战',
      desc: '三档难度任选，吃食物让小蛇越长越长。方向键、滑动或按钮控制转向，别撞墙也别咬到自己。',
      icon: '🐍', color: '#4CAF7D', path: 'games/snake/index.html',
      tags: ['经典', '三档难度', '怀旧'], order: 24
    },
    {
      id: 'breakout', title: '弹球打砖块',
      desc: '控制挡板弹起小球打碎全部砖块，接住掉落道具还能加宽挡板。霓虹画风，解压又上瘾。',
      icon: '🧱', color: '#B197FC', path: 'games/breakout/index.html',
      tags: ['经典', '瞄准连锁', '霓虹'], order: 25
    },

    /* ===== 洗护解压（3 款） ===== */
    {
      id: 'wash-pig', title: '冲洗小猪',
      desc: '满身泥巴的小猪脏兮兮，拿起水枪把正反面都冲干净，看它从难过变笑脸向你道谢。',
      icon: '🐷', thumb: 'assets/thumb-pig.webp', color: '#FF9AAE',
      path: 'games/wash-pig/index.html', tags: ['解压', '3D写实', '双面冲洗'], order: 26
    },
    {
      id: 'wash-car', title: '高压洗车',
      desc: '红色小车沾满泥浆，用高压水枪把车头车尾仔细冲洗，让爱车焕然一新。',
      icon: '🚗', thumb: 'assets/thumb-car.webp', color: '#7FC8F8',
      path: 'games/wash-car/index.html', tags: ['解压', '3D写实', '双面冲洗'], order: 27
    },
    {
      id: 'wash-carpet', title: '冲刷地毯',
      desc: '华丽地毯布满污渍，手持水枪冲刷正反两面，精美的花纹一点点显露出来。',
      icon: '🧹', thumb: 'assets/thumb-carpet.webp', color: '#C7A7F7',
      path: 'games/wash-carpet/index.html', tags: ['解压', '3D写实', '双面冲洗'], order: 28
    }
  ];

  GAMES.sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
  global.GAME_REGISTRY = GAMES;
})(window);
