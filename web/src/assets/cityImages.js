/**
 * 城市特色图片资源索引
 * 由 Vite 处理静态资源打包
 * 每个省份保留建筑/地形/元素 3 张，键名与 cityFeature.js 的图片键对应
 */
import tengwangPavilion from "./cities/tengwang-pavilion.png";
import lushanMountain from "./cities/lushan-mountain.png";
import mountEmei from "./cities/mount-emei.png";
import leshanBuddha from "./cities/leshan-buddha.png";
import jingdezhenPorcelain from "./cities/jingdezhen-porcelain.png";
import panda from "./cities/panda.png";
import forbiddenCity from "./cities/forbidden-city.png";
import greatWall from "./cities/great-wall.png";
import pekingDuck from "./cities/peking-duck.png";
import orientalPearl from "./cities/oriental-pearl.png";
import huangpuRiver from "./cities/huangpu-river.png";
import xiaolongbao from "./cities/xiaolongbao.png";
import potalaPalace from "./cities/potala-palace.png";
import snowMountain from "./cities/snow-mountain.png";
import yak from "./cities/yak.png";
import jiaxiuTower from "./cities/jiaxiu-tower.png";
import huangguoshuWaterfall from "./cities/huangguoshu-waterfall.png";
import miaoSilver from "./cities/miao-silver.png";
import goldenHorse from "./cities/golden-horse.png";
import dianchiLake from "./cities/dianchi-lake.png";
import riceNoodles from "./cities/rice-noodles.png";
import chongqingHongya from "./cities/chongqing-hongya.png";
import chongqingRiver from "./cities/chongqing-river.png";
import guangzhouTower from "./cities/guangzhou-tower.png";
import guangzhouDimsum from "./cities/guangzhou-dimsum.png";
import fujianTulou from "./cities/fujian-tulou.png";
import hainanBeach from "./cities/hainan-beach.png";
import harbinSophiaChurch from "./cities/harbin-sophia-church.png";
import harbinIceWorld from "./cities/harbin-ice-world.png";
import harbinCuisine from "./cities/harbin-cuisine.png";
import cityGeneric from "./cities/city-generic.png";

export const CITY_IMAGES = {
  "tengwang-pavilion": tengwangPavilion,
  "lushan-mountain": lushanMountain,
  "mount-emei": mountEmei,
  "leshan-buddha": leshanBuddha,
  "jingdezhen-porcelain": jingdezhenPorcelain,
  panda: panda,
  "forbidden-city": forbiddenCity,
  "great-wall": greatWall,
  "peking-duck": pekingDuck,
  "oriental-pearl": orientalPearl,
  "huangpu-river": huangpuRiver,
  xiaolongbao: xiaolongbao,
  "potala-palace": potalaPalace,
  "snow-mountain": snowMountain,
  yak: yak,
  "jiaxiu-tower": jiaxiuTower,
  "huangguoshu-waterfall": huangguoshuWaterfall,
  "miao-silver": miaoSilver,
  "golden-horse": goldenHorse,
  "dianchi-lake": dianchiLake,
  "rice-noodles": riceNoodles,
  "chongqing-hongya": chongqingHongya,
  "chongqing-river": chongqingRiver,
  "guangzhou-tower": guangzhouTower,
  "guangzhou-dimsum": guangzhouDimsum,
  "fujian-tulou": fujianTulou,
  "hainan-beach": hainanBeach,
  "harbin-sophia-church": harbinSophiaChurch,
  "harbin-ice-world": harbinIceWorld,
  "harbin-cuisine": harbinCuisine,
  "city-generic": cityGeneric,
};

/** 根据图片键字符串（逗号分隔，顺序：建筑,地形,元素）解析为图片 URL 数组 */
export function resolveCityImageKeys(keyStr) {
  if (!keyStr) return [];
  return keyStr
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => CITY_IMAGES[k])
    .filter(Boolean);
}

export default CITY_IMAGES;
