import { useEffect, useState } from 'react';
import { listChildFolders } from '../../lib/driveClient';

export type FamilyScope = { kind: 'me' } | { kind: 'member'; name: string };

type Props = {
  accessToken: string;
  familyRootId: string;
  scope: FamilyScope;
  onScopeChange: (scope: FamilyScope) => void;
  refreshToken: number;
};

export default function FamilySwitcher({
  accessToken,
  familyRootId,
  scope,
  onScopeChange,
  refreshToken,
}: Props) {
  const [members, setMembers] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let cancelled = false;
    listChildFolders(accessToken, familyRootId).then((folders) => {
      if (!cancelled) setMembers(folders.map((f) => f.name));
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, familyRootId, refreshToken]);

  const handleAddMember = () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(false);
    setNewName('');
    onScopeChange({ kind: 'member', name });
  };

  return (
    <div className="family-switcher">
      <div className="family-chips">
        <button
          className={`chip ${scope.kind === 'me' ? 'active' : ''}`}
          onClick={() => onScopeChange({ kind: 'me' })}
        >
          Me
        </button>
        {members.map((name) => (
          <button
            key={name}
            className={`chip ${scope.kind === 'member' && scope.name === name ? 'active' : ''}`}
            onClick={() => onScopeChange({ kind: 'member', name })}
          >
            {name}
          </button>
        ))}
        <button className="chip chip-add" onClick={() => setAdding(true)}>
          + Family Member
        </button>
      </div>

      {adding && (
        <div className="add-member-form">
          <input
            type="text"
            placeholder="Name (e.g. Mom, Priya)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <button className="text-button" onClick={handleAddMember}>
            Add
          </button>
          <button className="text-button" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
