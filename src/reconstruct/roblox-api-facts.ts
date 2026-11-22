import {robloxClasses, robloxDatatypes, robloxEnums, type RobloxApiClass} from './roblox-api.generated.js';

type MemberGroup = 'properties' | 'methods' | 'events' | 'callbacks' | 'staticMethods' | 'staticProperties';

function own<T>(table: Readonly<Record<string,T>> | undefined, name: string): T | undefined {
  return table && Object.hasOwn(table, name) ? table[name] : undefined;
}

function declaringType(receiver: string, name: string): RobloxApiClass | undefined {
  // Evaluating a member access on nil raises. On the returning path only
  // the non-nil arm supplies that member, even if the local remains optional.
  const type = receiver.endsWith('?') ? receiver.slice(0, -1) : receiver;
  let entry = own(robloxClasses, type) ?? own(robloxDatatypes, type);
  while (entry) {
    // A redeclaration can also change the member kind. Stop before a base
    // member when a subclass marks its own signature unknown.
    if (entry.blocked?.includes(name)) return undefined;
    if (own(entry.properties, name) !== undefined || own(entry.events, name) !== undefined ||
        own(entry.methods, name) !== undefined || own(entry.callbacks, name) !== undefined) return entry;
    entry = entry.base ? own(robloxClasses, entry.base) : undefined;
  }
  return undefined;
}

export function lookupRobloxEnumItem(name: string, item: string): string | undefined {
  return own(robloxEnums, name)?.includes(item) ? `Enum.${name}` : undefined;
}

export function lookupRobloxService(name: string): string | undefined {
  return own(robloxClasses, name)?.service ? name : undefined;
}

export function lookupRobloxCreatable(name: string): string | undefined {
  return own(robloxClasses, name)?.creatable ? name : undefined;
}

export function lookupRobloxEventParameters(receiver: string, name: string) {
  return own(declaringType(receiver, name)?.events, name);
}

export function lookupRobloxCallbackParameters(receiver: string, name: string) {
  return own(declaringType(receiver, name)?.callbacks, name);
}

export function lookupRobloxProperty(receiver: string, name: string): string | undefined {
  return own(declaringType(receiver, name)?.properties, name) ?? undefined;
}

export function lookupRobloxStaticProperty(global: string, name: string): string | undefined {
  return own(own(robloxDatatypes, global)?.staticProperties, name) ?? undefined;
}

function singleResult(entry: RobloxApiClass | undefined, group: Extract<MemberGroup, 'methods' | 'staticMethods'>,
                      name: string, args: number): string | undefined {
  const overloads = own(entry?.[group], name);
  const matching = overloads?.filter(([min,max]) => args >= min && (max === null || args <= max));
  const first = matching?.[0]?.[2];
  return first && matching!.every(signature => signature[2] === first) ? first : undefined;
}

export function lookupRobloxMethodResult(receiver: string, name: string, args = 0): string | undefined {
  const entry = declaringType(receiver, name);
  if (entry === own(robloxClasses, 'Instance') && entry && name === 'WaitForChild') {
    // Only the optional timeout permits a nil result.
    if (args === 1) return 'Instance';
    if (args === 2) return 'Instance?';
  }
  return singleResult(entry, 'methods', name, args);
}

export function lookupRobloxStaticResult(global: string, name: string, args: number): string | undefined {
  return singleResult(own(robloxDatatypes, global), 'staticMethods', name, args);
}
