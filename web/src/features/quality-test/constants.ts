/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { QualityTestStatus } from './types'

export const PELICAN_PROMPT =
  '创建一个 HTML，内容是用 SVG 绘制一个鹈鹕骑自行车的 2D 动画。你不需要任何测试。'

/** 提示词字节上限，与后端 qualityTestPromptLimit 保持一致 */
export const QUALITY_TEST_PROMPT_BYTE_LIMIT = 16000

export type QualityTestBuiltinPreset = {
  key: string
  /** i18n 键，展示时通过 t() 翻译 */
  nameKey: string
  prompt: string
}

/** 内置预设随前端发布、不入库；鹈鹕题为默认题目 */
export const QUALITY_TEST_BUILTIN_PRESETS: QualityTestBuiltinPreset[] = [
  {
    key: 'pelican',
    nameKey: 'Pelican riding a bicycle',
    prompt: PELICAN_PROMPT,
  },
  {
    key: 'polarbear',
    nameKey: 'Polar bear riding a bicycle',
    prompt:
      '创建一个 HTML，用 SVG 绘制一只北极熊骑自行车的 2D 动画：北极熊体型圆润、白色毛发、黑鼻子，坐在一辆两轮自行车上，双腿随踏板做圆周蹬踏，车轮持续转动并带辐条，背景是雪地与远处的冰山，雪花缓缓飘落。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'ultraman',
    nameKey: 'Ultraman riding a motorcycle',
    prompt:
      '创建一个 HTML，用 SVG 绘制奥特曼骑摩托车的 2D 动画：奥特曼为银红配色、头顶有鳍状冠、胸口有闪烁的计时器，跨坐在一辆流线型摩托车上向右疾驰，车轮高速旋转、尾部拖出速度线，背景是横向滚动的城市楼群，天上偶尔有怪兽剪影掠过。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'octopus',
    nameKey: 'Octopus playing drums',
    prompt:
      '创建一个 HTML，用 SVG 绘制一只章鱼打架子鼓的 2D 动画：章鱼有 8 条可辨的触手，分别握着鼓棒，同时敲击底鼓、军鼓、镲片等至少 5 件鼓组部件，敲击节奏要稳定循环，被击中的部件有震动或闪光反馈，章鱼头部随节拍轻微点动。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'giraffe',
    nameKey: 'Giraffe on a skateboard',
    prompt:
      '创建一个 HTML，用 SVG 绘制一只长颈鹿踩滑板的 2D 动画：长颈鹿脖子明显修长、带棕色斑块，四蹄站在一块滑板上从左向右滑行，滑板轮子转动，途中遇到一个小坡道时做起跳与落地动作，脖子随动作前后摆动，背景是热带草原与移动的云。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'mooncat',
    nameKey: 'Astronaut cat fishing on the moon',
    prompt:
      '创建一个 HTML，用 SVG 绘制一只穿宇航服的猫在月球上钓鱼的 2D 动画：猫戴着透明头盔、尾巴从宇航服后面伸出，坐在月面环形山边缘，鱼竿伸向一片漂浮的星星湖，钓线末端不时钓起一颗闪光的星星，背景是漆黑太空、缓慢自转的地球与散布的星点，猫会偶尔甩尾。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'clock',
    nameKey: 'Analog clock',
    prompt:
      '创建一个 HTML，用 SVG 绘制一个模拟时钟：有表盘刻度、时针、分针、秒针，读取浏览器本地时间实时走针，秒针平滑扫动，时针随分钟联动偏移。表盘下方用数字显示当前时间。所有样式与脚本内联，不引用外部资源。你不需要任何测试。',
  },
  {
    key: 'solar',
    nameKey: 'Solar system',
    prompt:
      '创建一个 HTML，用 SVG 绘制太阳系动画：太阳居中，至少包含水星、金星、地球、火星、木星、土星六颗行星沿各自轨道公转，公转周期按真实比例缩放（地球 1 圈时水星约 4 圈、土星约 1/29 圈），地球带一颗绕转的月球，土星有光环，每颗行星标注中文名称。深色星空背景带闪烁星点。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'balls',
    nameKey: 'Bouncing balls physics',
    prompt:
      '创建一个 HTML，用 Canvas 或 SVG 实现弹跳小球物理模拟：初始生成 8 个不同颜色和半径的小球，受重力作用下落，碰到容器四壁反弹并有能量损耗，小球之间发生碰撞时按动量守恒交换速度，不允许相互穿透或卡在墙内。点击画面任意位置新增一个小球。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'gears',
    nameKey: 'Meshing gears',
    prompt:
      '创建一个 HTML，用 SVG 绘制一组相互啮合的齿轮传动动画：至少 4 个齿轮，齿数分别为 12、24、36、18，齿形要真实可辨，相邻齿轮的齿必须正确啮合而不重叠或穿透，转速与齿数成反比，转向相邻相反。用不同颜色区分齿轮，并在每个齿轮中心标注齿数。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'city',
    nameKey: 'Parallax city at night',
    prompt:
      '创建一个 HTML，用 SVG 绘制一幅横向无限滚动的城市夜景：至少三层视差（远景山脉与月亮、中景楼群、近景马路），层速由远到近递增；楼窗随机点亮熄灭，马路上有汽车往返行驶并带车灯，天空偶尔划过流星。画面循环时不能出现接缝或跳变。所有样式与脚本内联。你不需要任何测试。',
  },
  {
    key: 'strokes',
    nameKey: 'Stroke order of 永',
    prompt:
      '创建一个 HTML，用 SVG 路径动画演示汉字「永」的书写过程：按正确笔顺逐笔书写，共 5 笔（点、横折钩、横撇、撇、捺），每一笔用 stroke-dashoffset 动画呈现毛笔运笔效果，笔画粗细有提按变化，写完一笔再写下一笔，全部写完后暂停两秒重新开始。旁边列出笔顺编号。所有样式与脚本内联。你不需要任何测试。',
  },
]

export const QUALITY_TEST_STATUS_LABELS: Record<
  QualityTestStatus | 'idle',
  string
> = {
  idle: 'Waiting for a test',
  running: 'Generating',
  cancelling: 'Stopping',
  completed: 'Completed',
  error: 'Failed',
  stopped: 'Stopped',
  interrupted: 'Interrupted',
}

/** 思考强度展示名；'' 代表不下发，由模型默认值决定 */
export const QUALITY_TEST_EFFORT_LABELS: Record<string, string> = {
  '': 'Model default',
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

export const QUALITY_TEST_ENDPOINT_LABELS: Record<string, string> = {
  openai: 'OpenAI Chat Completions',
  'openai-response': 'OpenAI Responses',
  anthropic: 'Anthropic Messages',
}

export const QUALITY_TEST_REVIEW_CRITERIA = [
  'Shape: is the subject recognizable with correct proportions?',
  'Mechanics: do the parts connect and move plausibly?',
  'Motion: is the animation smooth, looping and free of glitches?',
  'Completion: does the page run standalone and follow every instruction?',
]
