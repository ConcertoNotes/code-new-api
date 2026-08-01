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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

// Bump this suffix to force all visitors to re-accept after a wording change.
const STORAGE_KEY = 'overseas_disclaimer_accepted_v1'

const DISCLAIMER = {
  zh: {
    title: '服务声明与免责条款',
    intro: '请在使用本服务前仔细阅读以下声明：',
    items: [
      '本服务及其全部服务器均部署、运营于中国大陆境外。本站不在中国大陆境内提供服务，亦不针对中国大陆用户开展任何经营活动。',
      '您理解并确认，您系基于自身需要、主动且自愿访问本服务，并自行承担访问及使用本服务的全部风险与法律责任。',
      '您应遵守您所在国家或地区的法律法规。若您所在地区的法律禁止或限制访问本类服务，请您立即停止访问并离开本站。',
      '本服务按“现状”提供，本站不对其可用性、连续性、准确性作任何明示或默示的担保。',
      '您对通过本服务提交、传输的全部内容独立承担责任，不得将本服务用于任何违法违规用途。',
    ],
    footer: '点击“我已阅读并同意”，即表示您已完整阅读、理解并接受上述全部内容。',
    agree: '我已阅读并同意',
    leave: '不同意，离开',
    agreementTitle: '数据中转服务协议',
    agreementIntro:
      '依据《中华人民共和国民法典》《中华人民共和国网络安全法》《中华人民共和国数据安全法》《中华人民共和国个人信息保护法》等相关法律法规，甲乙双方本着平等自愿、诚实信用的原则，就甲方使用乙方数据中转服务相关事宜，订立本协议，以资共同信守。',
    agreementSections: [
      {
        heading: '一、服务定义与核心规则',
        paragraphs: [
          '乙方为甲方提供纯数据中转传输服务，仅作为网络数据传输通道，按照甲方指令，对其发起的网络请求、响应数据进行纯粹转发、中转传输，不提供任何数据存储、处理、编辑、分析、篡改、审核等附加服务。',
          '乙方仅中转、不存储，全程不留存任何甲方的请求数据、响应数据，中转传输完成后立即清除临时传输缓存，无任何数据副本、传输日志及访问痕迹留存。',
          '乙方不对中转数据进行任何形式的读取、复制、泄露、传播、商用等操作，除司法机关、行政监管部门依法出具正式法律文书外，绝不向任何第三方披露甲方传输数据及传输轨迹。',
        ],
      },
      {
        heading: '二、甲方（用户）权利与义务',
        paragraphs: [
          '甲方有权在遵守本协议及法律法规的前提下，使用乙方提供的数据中转服务，享有正常的数据传输通道使用权。',
          '数据出境合规责任：甲方通过本服务进行数据出境传输的，全部合规责任由甲方自行承担。甲方需自行完成数据出境安全评估、个人信息出境备案/认证等法定程序，确保数据出境符合中国及数据目的地国家/地区法律法规，因违规出境产生的一切法律责任、罚款、索赔等损失，均由甲方自行承担。',
          '信息使用限制：甲方承诺，绝不通过本服务输入、传输任何敏感信息，敏感信息包括但不限于国家秘密、涉政敏感信息、商业秘密、个人敏感信息、违法违规信息、色情暴力信息、危害国家安全及社会公共利益的信息，以及侵犯第三方知识产权、隐私权等合法权益的信息。',
          '甲方自行承担使用本服务的网络、设备、合规等全部成本，自行负责自身数据的加密、安全防护、备份工作，自行保管服务使用账号、密钥等信息。',
          '甲方不得利用本服务从事任何违法违规活动，否则乙方有权立即终止服务，甲方需承担由此给乙方造成的全部损失。',
        ],
      },
      {
        heading: '三、乙方（我方）权利与义务',
        paragraphs: [
          '乙方按照协议约定，为甲方提供稳定、通畅的数据中转传输通道，保障服务正常运行，维护传输通道稳定性。',
          '乙方严格恪守“不存储、不篡改、不泄露、不使用”中转数据的核心义务，严守数据传输边界，不干预甲方正常合法的中转传输行为。',
          '因不可抗力、基础网络故障、政策法规调整、网络攻击、第三方运营商问题等不可归责于乙方的原因导致服务中断、传输异常的，乙方不承担违约责任，但应及时告知甲方并协助排查问题。',
          '乙方有权对服务使用情况进行监测，若发现甲方违规使用服务、传输敏感/违法数据、违规数据出境等行为，有权立即暂停、终止提供服务，关闭传输通道，已收取的服务费用不予退还。',
          '乙方配合司法机关、行政监管部门依法开展的核查工作，按要求提供必要的服务相关信息（不含甲方传输数据内容）。',
        ],
      },
      {
        heading: '四、免责条款',
        paragraphs: [
          '因不可抗力、政府行政指令、法律法规强制调整、网络运营商线路故障、恶意网络攻击等不可预见、不可抗拒、不可控制因素，导致服务中断、传输失败、数据异常的，乙方无需承担任何违约责任及赔偿责任。',
          '乙方仅提供数据中转通道，不对甲方传输数据的真实性、合法性、完整性负责，不对甲方业务亏损、预期利益、间接经济损失等承担赔偿责任。',
          '因甲方自身操作失误、设备故障、账号泄露、数据加密不足、自身合规疏漏等原因，导致的一切损失，均由甲方自行承担。',
        ],
      },
      {
        heading: '五、违约责任',
        paragraphs: [
          '若乙方违反本协议核心约定，擅自存储、泄露、使用甲方中转数据，需依法承担给甲方造成的直接经济损失（法律法规免责情形除外）。',
          '若甲方违反本协议约定，存在违规数据出境、传输敏感/违法信息、违约使用服务等行为，属于甲方根本违约，乙方有权单方解除本协议、停止服务，甲方应赔偿乙方因此遭受的全部损失（包括但不限于罚款、第三方索赔、律师费、诉讼费等维权费用）。',
        ],
      },
      {
        heading: '六、协议生效与终止',
        paragraphs: [
          '本协议自甲方确认使用乙方数据中转服务（注册）起生效。',
          '甲方停止使用服务、双方结清所有权利义务后，本协议自动终止；乙方因业务调整、政策要求可提前告知甲方后终止服务，协议同步终止。',
          '协议终止后，本协议中关于合规责任、免责条款、违约责任、争议解决的条款，对双方仍具有法律约束力。',
        ],
      },
      {
        heading: '七、争议解决',
        paragraphs: [
          '本协议适用中华人民共和国法律，双方因本协议产生的争议，优先友好协商解决；协商不成的，任何一方均有权向乙方所在地人民法院提起诉讼。',
        ],
      },
      {
        heading: '八、其他条款',
        paragraphs: [
          '乙方有权根据法律法规、政策调整、业务优化，对本协议条款进行修订，修订后通过官方渠道公示，公示期满即生效；甲方继续使用服务，视为认可修订后的协议。',
        ],
      },
      {
        heading: '九、协议生效约定',
        paragraphs: [
          '甲方一经登录、注册或实际使用乙方数据中转服务，即代表甲方已完整阅读、充分理解并自愿同意本协议全部条款，自愿接受本协议所有约束，本协议即时生效；若甲方不同意本协议任何条款，请立即停止使用本服务。',
        ],
      },
    ],
  },
  en: {
    title: 'Service Disclaimer',
    intro: 'Please read the following statement carefully before using this service:',
    items: [
      'This service and all of its servers are deployed and operated outside of mainland China. This site does not provide services within mainland China and does not target users located in mainland China.',
      'You acknowledge that you are accessing this service on your own initiative and of your own free will, and you assume all risks and legal responsibility for accessing and using it.',
      'You must comply with the laws and regulations of your own country or region. If the laws of your jurisdiction prohibit or restrict access to this type of service, you must stop and leave this site immediately.',
      'This service is provided "as is", without any express or implied warranty of availability, continuity, or accuracy.',
      'You are solely responsible for all content you submit or transmit through this service and must not use it for any unlawful purpose.',
    ],
    footer:
      'By clicking "I have read and agree", you confirm that you have fully read, understood, and accepted all of the above.',
    agree: 'I have read and agree',
    leave: 'I do not agree, leave',
  },
}

export function DisclaimerDialog() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'true') {
        setOpen(true)
      }
    } catch {
      // localStorage unavailable (private mode); show the notice anyway.
      setOpen(true)
    }
  }, [])

  const copy = i18n.language?.startsWith('zh') ? DISCLAIMER.zh : DISCLAIMER.en

  const handleAgree = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      /* ignore persistence failure */
    }
    setOpen(false)
  }

  const handleLeave = () => {
    window.location.href = 'about:blank'
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className='flex max-h-[min(88dvh,720px)] w-[calc(100vw-1.5rem)] !max-w-[40rem] grid-rows-none flex-col gap-0 overflow-hidden !p-0 sm:w-[min(40rem,calc(100vw-3rem))]'>
        <AlertDialogHeader className='shrink-0 px-4 pt-4 pb-3 text-left sm:px-6 sm:pt-6 sm:!place-items-start sm:!text-left'>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />} className='mt-1 text-left leading-5'>
            {copy.intro}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6'>
          <ol className='border-border/70 bg-muted/30 text-foreground list-decimal space-y-2 rounded-lg border px-4 py-3 pl-8 text-sm leading-6 sm:px-5 sm:py-4 sm:pl-9'>
            {copy.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <p className='text-muted-foreground mt-3 text-xs leading-5'>{copy.footer}</p>

          {'agreementSections' in copy && copy.agreementSections ? (
            <div className='border-border/70 bg-muted/30 text-foreground mt-4 rounded-lg border px-4 py-3 sm:px-5 sm:py-4'>
              <p className='text-sm font-medium'>{copy.agreementTitle}</p>
              <p className='text-muted-foreground mt-2 text-xs leading-6'>{copy.agreementIntro}</p>
              <div className='mt-3 space-y-3'>
                {copy.agreementSections.map((section) => (
                  <div key={section.heading}>
                    <p className='text-sm font-medium'>{section.heading}</p>
                    <div className='mt-1 space-y-1.5'>
                      {section.paragraphs.map((p, i) => (
                        <p key={i} className='text-muted-foreground text-xs leading-6'>
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <AlertDialogFooter className='mx-0 mb-0 shrink-0 rounded-b-xl border-t p-3 sm:p-4'>
          <Button variant='outline' onClick={handleLeave}>
            {copy.leave}
          </Button>
          <Button onClick={handleAgree}>{copy.agree}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
