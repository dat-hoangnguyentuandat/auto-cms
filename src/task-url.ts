export function parseTaskUrl(input: string) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.hostname !== 'erp.19t.vn') throw new Error('Only https://erp.19t.vn task URLs are supported');
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const taskId = fragment.get('id');
  const model = fragment.get('model');
  if (!taskId || !/^\d+$/.test(taskId)) throw new Error('ERP task URL is missing a numeric id');
  if (model !== 'project.task') throw new Error('ERP URL must target model=project.task');
  return { url: url.href, taskId, model };
}

