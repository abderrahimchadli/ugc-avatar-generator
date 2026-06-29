export const FLOW_URL = 'https://labs.google/fx/tools/flow'
export const CHATGPT_IMAGES_URL = 'https://chatgpt.com/images'

export function getToolUrl(source) {
  return source === 'google-flow' ? FLOW_URL : CHATGPT_IMAGES_URL
}
