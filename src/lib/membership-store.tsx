import { createContext, useContext, useState, type ReactNode } from 'react';
import { accountNumberFor, initialProfiles, memberSchema, type MemberDetails, type MemberProfile } from './membership';
import { TODAY } from './finance';

type Store = {
  profiles: MemberProfile[];
  addMember: (details: MemberDetails, addedBy: 'self' | 'admin') => MemberProfile;
  updateMember: (id: string, details: MemberDetails) => void;
};
const Ctx = createContext<Store | null>(null);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  function addMember(details: MemberDetails, addedBy: 'self' | 'admin') {
    const parsed = memberSchema.parse(details);
    if (profiles.some(p => p.pcnNumber.toLowerCase() === parsed.pcnNumber.toLowerCase())) throw new Error('A member with this PCN number already exists.');
    const profile: MemberProfile = { ...parsed, id: `m${profiles.length + 1}`, accountNumber: accountNumberFor(profiles.length + 1), joined: TODAY, addedBy };
    setProfiles(prev => [...prev, profile]);
    return profile;
  }
  function updateMember(id: string, details: MemberDetails) {
    const parsed = memberSchema.parse(details);
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...parsed } : p));
  }
  return <Ctx.Provider value={{ profiles, addMember, updateMember }}>{children}</Ctx.Provider>;
}

export function useMembership() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMembership must be used inside MembershipProvider');
  return v;
}
