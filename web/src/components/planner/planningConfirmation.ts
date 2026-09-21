export function isExplicitApplyAllMessage(message: string) {
  const compact = message.replace(/[\s，,。.!！?？]/g, '');
  return /^(确认|确定|同意)$/.test(compact)
    || /^(确认|确定|同意)(全部|都)?(执行|应用|取消)$/.test(compact)
    || /^(确认|确定|同意)(全部|都)取消$/.test(compact);
}
