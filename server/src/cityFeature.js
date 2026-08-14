/**
 * 城市特色数据（出发地/目的地 → 当地建筑、地形、特色元素）
 * 用于前端横幅根据出发地/目的地动态展示当地特色
 * 这里只放轻量 emoji 与文字；图片资源由前端 assets/cityImages.js 提供
 */

/** 省份 → 图片键（建筑,地形,元素） */
const PROVINCE_IMAGE_KEYS = {
  江西: "tengwang-pavilion,lushan-mountain,jingdezhen-porcelain",
  四川: "leshan-buddha,mount-emei,panda",
  北京: "forbidden-city,great-wall,peking-duck",
  上海: "oriental-pearl,huangpu-river,xiaolongbao",
  西藏: "potala-palace,snow-mountain,yak",
  贵州: "jiaxiu-tower,huangguoshu-waterfall,miao-silver",
  云南: "golden-horse,dianchi-lake,rice-noodles",
  重庆: "chongqing-hongya,chongqing-river,chongqing-river",
  广东: "guangzhou-tower,guangzhou-dimsum,guangzhou-dimsum",
  福建: "fujian-tulou,fujian-tulou,fujian-tulou",
  海南: "hainan-beach,hainan-beach,hainan-beach",
};

const CITY_FEATURES = {
  南昌: {
    省份: "江西",
    特色建筑: ["滕王阁", "八一起义馆", "绳金塔"],
    地形: ["庐山", "鄱阳湖", "梅岭"],
    特色元素: ["景德镇瓷器", "婺源徽派建筑", "瓦罐汤"],
    建筑emoji: "🏯",
    地形emoji: "⛰️",
    元素emoji: "🏺",
  },
  九江: {
    省份: "江西",
    特色建筑: ["浔阳楼", "白鹿洞书院"],
    地形: ["庐山", "鄱阳湖"],
    特色元素: ["庐山云雾茶"],
    建筑emoji: "🏯",
    地形emoji: "⛰️",
    元素emoji: "🍵",
  },
  成都: {
    省份: "四川",
    特色建筑: ["乐山大佛", "武侯祠", "宽窄巷子"],
    地形: ["峨眉山", "青城山", "锦江"],
    特色元素: ["大熊猫", "川味火锅", "盖碗茶"],
    建筑emoji: "🗿",
    地形emoji: "⛰️",
    元素emoji: "🐼",
  },
  乐山: {
    省份: "四川",
    特色建筑: ["乐山大佛", "凌云寺"],
    地形: ["峨眉山", "三江汇流"],
    特色元素: ["跷脚牛肉", "甜皮鸭"],
    建筑emoji: "🗿",
    地形emoji: "⛰️",
    元素emoji: "🥩",
  },
  北京: {
    省份: "北京",
    特色建筑: ["故宫", "天安门", "天坛"],
    地形: ["长城", "香山"],
    特色元素: ["烤鸭", "胡同", "京剧"],
    建筑emoji: "🏯",
    地形emoji: "🏔️",
    元素emoji: "🦆",
  },
  上海: {
    省份: "上海",
    特色建筑: ["东方明珠", "外滩", "豫园"],
    地形: ["黄浦江", "崇明岛"],
    特色元素: ["小笼包", "老洋房"],
    建筑emoji: "🗼",
    地形emoji: "🌊",
    元素emoji: "🥟",
  },
  拉萨: {
    省份: "西藏",
    特色建筑: ["布达拉宫", "大昭寺"],
    地形: ["雪山", "纳木错"],
    特色元素: ["藏袍", "经幡", "牦牛"],
    建筑emoji: "🏯",
    地形emoji: "🏔️",
    元素emoji: "🐂",
  },
  贵阳: {
    省份: "贵州",
    特色建筑: ["甲秀楼", "侗寨鼓楼"],
    地形: ["黄果树瀑布", "梵净山"],
    特色元素: ["苗族银饰", "酸汤鱼"],
    建筑emoji: "🏯",
    地形emoji: "💧",
    元素emoji: "🐟",
  },
  昆明: {
    省份: "云南",
    特色建筑: ["金马碧鸡坊", "崇圣寺三塔"],
    地形: ["滇池", "石林", "西山"],
    特色元素: ["过桥米线", "鲜花饼", "海鸥"],
    建筑emoji: "🏯",
    地形emoji: "🌊",
    元素emoji: "🌹",
  },
  重庆: {
    省份: "重庆",
    特色建筑: ["洪崖洞", "解放碑", "磁器口"],
    地形: ["长江", "嘉陵江", "武隆天坑"],
    特色元素: ["重庆火锅", "轻轨穿楼", "朝天门"],
    建筑emoji: "🏯",
    地形emoji: "🌊",
    元素emoji: "🍲",
  },
  广州: {
    省份: "广东",
    特色建筑: ["广州塔", "陈家祠", "镇海楼"],
    地形: ["珠江", "白云山"],
    特色元素: ["早茶", "骑楼", "粤剧"],
    建筑emoji: "🗼",
    地形emoji: "🌊",
    元素emoji: "🍜",
  },
  深圳: {
    省份: "广东",
    特色建筑: ["平安大厦", "世界之窗"],
    地形: ["深圳湾", "大梅沙"],
    特色元素: ["科技园", "华强北"],
    建筑emoji: "🏙️",
    地形emoji: "🌊",
    元素emoji: "💻",
  },
  福州: {
    省份: "福建",
    特色建筑: ["三坊七巷", "乌塔"],
    地形: ["武夷山", "闽江"],
    特色元素: ["土楼", "茉莉花茶", "佛跳墙"],
    建筑emoji: "🏯",
    地形emoji: "⛰️",
    元素emoji: "🍵",
  },
  厦门: {
    省份: "福建",
    特色建筑: ["鼓浪屿", "环岛路"],
    地形: ["武夷山", "海岸线"],
    特色元素: ["沙茶面", "土楼"],
    建筑emoji: "🏝️",
    地形emoji: "🌊",
    元素emoji: "🍜",
  },
  海口: {
    省份: "海南",
    特色建筑: ["骑楼老街", "火山口公园"],
    地形: ["三亚湾", "五指山"],
    特色元素: ["椰子鸡", "清补凉", "沙滩"],
    建筑emoji: "🏝️",
    地形emoji: "🌊",
    元素emoji: "🥥",
  },
  三亚: {
    省份: "海南",
    特色建筑: ["天涯海角", "南山寺"],
    地形: ["亚龙湾", "蜈支洲岛"],
    特色元素: ["海鲜", "椰风海韵"],
    建筑emoji: "🏝️",
    地形emoji: "🌊",
    元素emoji: "🦞",
  },
};

/** 根据城市名获取当地特色（找不到返回通用） */
export function getCityFeature(city) {
  if (!city) city = "";
  // 别名映射：支持省级简称/全称
  const ALIASES = {
    "广东": "广州", "广东省": "广州",
    "重庆": "重庆", "重庆市": "重庆",
    "四川": "成都", "四川省": "成都",
    "西藏": "拉萨", "西藏自治区": "拉萨",
    "云南": "昆明", "云南省": "昆明",
    "贵州": "贵阳", "贵州省": "贵阳",
    "北京": "北京", "北京市": "北京",
    "上海": "上海", "上海市": "上海",
    "江西": "南昌", "江西省": "南昌",
    "福建": "福州", "福建省": "福州",
    "海南": "海口", "海南省": "海口",
  };
  const key = ALIASES[city] || ALIASES[city.replace(/[省市自治区]+$/, "")] || city;
  const f = CITY_FEATURES[key] || CITY_FEATURES[city];
  if (f) {
    return {
      ...f,
      图片键: PROVINCE_IMAGE_KEYS[f.省份] || "tengwang-pavilion,lushan-mountain,jingdezhen-porcelain",
    };
  }
  return {
    省份: city || "未知",
    特色建筑: [city || "当地地标"],
    地形: ["山水"],
    特色元素: ["当地美食"],
    建筑emoji: "🏙️",
    地形emoji: "🏞️",
    元素emoji: "🍜",
    图片键: "tengwang-pavilion,lushan-mountain,jingdezhen-porcelain",
  };
}

export default CITY_FEATURES;
