---
{"title":"LOVABLE - Frontend Integration Guide","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/LOVABLE - Frontend Integration Guide/","dgPassFrontmatter":true,"noteIcon":""}
---



## 📱 АРХІТЕКТУРА

**Ключові зміни:**
- ✅ Lovable як статичний фронтенд (не змінюється)
- ✅ Управління MCP серверами в окремому UI модалі
- ✅ Показ списку активних MCP серверів
- ✅ Можливість видалення серверів

---

## PART 1: Configuration Files

### `.env.local`

```bash
VITE_API_GATEWAY_URL=https://api.garden.example.com
VITE_N8N_WEBHOOK_URL=https://your-n8n.com/webhook/export
VITE_API_BEARER_TOKEN=your-bearer-token
VITE_APP_NAME=Garden Export System
VITE_CORS_ORIGIN=https://violin.pp.ua
```

### `.env.production`

```bash
VITE_API_GATEWAY_URL=https://api.garden.example.com
VITE_N8N_WEBHOOK_URL=https://your-n8n.com/webhook/export
VITE_API_BEARER_TOKEN=your-production-bearer-token
VITE_APP_NAME=Garden Export System
VITE_CORS_ORIGIN=https://violin.pp.ua
```

### `src/config/api-config.ts`

```typescript
export const API_CONFIG = {
  GATEWAY_URL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8787',
  N8N_WEBHOOK_URL: import.meta.env.VITE_N8N_WEBHOOK_URL,
  BEARER_TOKEN: import.meta.env.VITE_API_BEARER_TOKEN,
  ENDPOINTS: {
    EXPORT: '/export',
    LIST_INSTANCES: '/mcp-instances',
    GET_INSTANCE: (id: string) => `/mcp/${id}`,
    DELETE_INSTANCE: (id: string) => `/mcp/${id}`,
    UPDATE_INSTANCE: (id: string) => `/mcp/${id}`,
    HEALTH: '/health',
    CLEANUP: '/cleanup',
  },
} as const;

export interface MCPInstance {
  id: string;
  folders: string[];
  format: 'markdown' | 'json' | 'jsonl';
  name: string;
  status: 'pending' | 'active' | 'expired' | 'deleted';
  created_at: string;
  expires_at: string;
  n8n_workflow_id?: string;
  sse_endpoint?: string;
  access_count: number;
  data_size_mb: number;
  retention_days: number;
}

export interface ExportRequest {
  folders: string[];
  format: 'markdown' | 'json' | 'jsonl';
  name?: string;
  retention_days?: number;
}
```

---

## PART 2: Export Modal Component

### `src/components/ExportModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { API_CONFIG, MCPInstance, ExportRequest } from '../config/api-config';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFolders: string[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  availableFolders,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'manage'>('export');
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [format, setFormat] = useState<'markdown' | 'json' | 'jsonl'>('markdown');
  const [retentionDays, setRetentionDays] = useState(30);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manage tab state
  const [instances, setInstances] = useState<MCPInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  // Fetch instances when manage tab opens
  useEffect(() => {
    if (activeTab === 'manage' && isOpen) {
      fetchInstances();
    }
  }, [activeTab, isOpen]);

  const fetchInstances = async () => {
    setLoadingInstances(true);
    try {
      const response = await fetch(
        `${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.LIST_INSTANCES}`,
        {
          headers: {
            Authorization: `Bearer ${API_CONFIG.BEARER_TOKEN}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch instances');

      const data = await response.json();
      setInstances(data.instances || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch instances');
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleExport = async () => {
    if (selectedFolders.length === 0) {
      setError('Please select at least one folder');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: ExportRequest = {
        folders: selectedFolders,
        format,
        name: customName || `Export ${selectedFolders.join(', ')}`,
        retention_days: retentionDays,
      };

      const response = await fetch(
        `${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.EXPORT}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const data = await response.json();
      setSuccess(
        `MCP server created! ID: ${data.mcp_id}. Status: ${data.status}`
      );

      // Reset form
      setSelectedFolders([]);
      setFormat('markdown');
      setRetentionDays(30);
      setCustomName('');

      // Refresh instances list
      setTimeout(() => {
        if (activeTab === 'manage') {
          fetchInstances();
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) {
      return;
    }

    try {
      const response = await fetch(
        `${API_CONFIG.GATEWAY_URL}${API_CONFIG.ENDPOINTS.DELETE_INSTANCE(id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${API_CONFIG.BEARER_TOKEN}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete instance');

      setSuccess('MCP server deleted successfully');
      fetchInstances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete instance');
    }
  };

  const toggleFolder = (folder: string) => {
    setSelectedFolders((prev) =>
      prev.includes(folder)
        ? prev.filter((f) => f !== folder)
        : [...prev, folder]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'expired':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>📤 MCP Export Manager</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'export' ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab('export')}
          >
            Create Export
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === 'manage' ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab('manage')}
          >
            Manage Servers ({instances.length})
          </button>
        </div>

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div style={styles.content}>
            {/* Folder Selection */}
            <div style={styles.section}>
              <label style={styles.label}>Select Folders</label>
              <div style={styles.folderGrid}>
                {availableFolders.map((folder) => (
                  <label key={folder} style={styles.folderCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedFolders.includes(folder)}
                      onChange={() => toggleFolder(folder)}
                      style={styles.checkbox}
                    />
                    {folder}
                  </label>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div style={styles.section}>
              <label style={styles.label}>Export Format</label>
              <select
                value={format}
                onChange={(e) =>
                  setFormat(e.target.value as 'markdown' | 'json' | 'jsonl')
                }
                style={styles.select}
              >
                <option value="markdown">Markdown (.md)</option>
                <option value="json">JSON</option>
                <option value="jsonl">JSONL (newline-delimited)</option>
              </select>
            </div>

            {/* Retention Days */}
            <div style={styles.section}>
              <label style={styles.label}>
                Retention: {retentionDays} days (max 90)
              </label>
              <input
                type="range"
                min="1"
                max="90"
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                style={styles.range}
              />
            </div>

            {/* Custom Name */}
            <div style={styles.section}>
              <label style={styles.label}>Custom Name (optional)</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Arsenal Export Jan 2026"
                style={styles.input}
              />
            </div>

            {/* Messages */}
            {error && <div style={styles.error}>{error}</div>}
            {success && <div style={styles.success}>{success}</div>}

            {/* Actions */}
            <div style={styles.actions}>
              <button
                style={styles.btnSecondary}
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                style={styles.btnPrimary}
                onClick={handleExport}
                disabled={loading || selectedFolders.length === 0}
              >
                {loading ? 'Creating...' : '✓ Create MCP Export'}
              </button>
            </div>
          </div>
        )}

        {/* Manage Tab */}
        {activeTab === 'manage' && (
          <div style={styles.content}>
            {loadingInstances ? (
              <div style={styles.loading}>Loading instances...</div>
            ) : instances.length === 0 ? (
              <div style={styles.empty}>No MCP servers created yet</div>
            ) : (
              <div style={styles.instancesList}>
                {instances.map((instance) => (
                  <div key={instance.id} style={styles.instanceCard}>
                    <div style={styles.instanceHeader}>
                      <div>
                        <h4 style={styles.instanceName}>{instance.name}</h4>
                        <div style={styles.instanceMeta}>
                          <span style={{ color: getStatusColor(instance.status) }}>
                            ● {instance.status.toUpperCase()}
                          </span>
                          <span>│ {instance.folders.join(', ')}</span>
                          <span>│ {instance.format}</span>
                        </div>
                      </div>
                      <button
                        style={styles.btnDelete}
                        onClick={() => handleDeleteInstance(instance.id)}
                        title="Delete this MCP server"
                      >
                        🗑️
                      </button>
                    </div>
                    <div style={styles.instanceFooter}>
                      <small>Created: {new Date(instance.created_at).toLocaleString()}</small>
                      <small>Expires: {new Date(instance.expires_at).toLocaleString()}</small>
                      <small>Accessed: {instance.access_count} times</small>
                    </div>
                    {instance.sse_endpoint && (
                      <div style={styles.instanceEndpoint}>
                        <code style={styles.code}>{instance.sse_endpoint}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.actions}>
              <button style={styles.btnSecondary} onClick={onClose}>
                Close
              </button>
              <button
                style={styles.btnSecondary}
                onClick={fetchInstances}
                disabled={loadingInstances}
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: '#000',
    borderBottomColor: '#3b82f6',
  },
  content: {
    padding: '24px',
  },
  section: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
  },
  folderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '8px',
  },
  folderCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  checkbox: {
    cursor: 'pointer',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
  },
  range: {
    width: '100%',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
  },
  error: {
    padding: '12px 16px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  success: {
    padding: '12px 16px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px',
  },
  btnPrimary: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  btnSecondary: {
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  btnDelete: {
    padding: '4px 8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
  },
  instancesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  instanceCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
    backgroundColor: '#f9fafb',
  },
  instanceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  instanceName: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: '600',
  },
  instanceMeta: {
    fontSize: '12px',
    color: '#6b7280',
    display: 'flex',
    gap: '8px',
  },
  instanceFooter: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px',
  },
  instanceEndpoint: {
    marginTop: '8px',
  },
  code: {
    fontSize: '11px',
    fontFamily: 'monospace',
    backgroundColor: '#fff',
    padding: '4px 6px',
    borderRadius: '4px',
    wordBreak: 'break-all',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '24px',
    color: '#6b7280',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '24px',
    color: '#9ca3af',
  },
};
```

---

## PART 3: Integration with FileStructure Component

### Update `src/components/FileStructure.tsx`

Add this where you want the export button:

```typescript
import { ExportModal } from './ExportModal';

export const FileStructure: React.FC = () => {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [folders, setFolders] = useState<string[]>([
    '/Arsenal',
    '/Living',
    '/Projects',
    // Add all your folders here
  ]);

  return (
    <div>
      {/* Your existing file structure UI */}
      
      {/* Add export button */}
      <button
        style={{
          padding: '8px 16px',
          backgroundColor: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '12px',
        }}
        onClick={() => setExportModalOpen(true)}
      >
        📤 Export Context
      </button>

      {/* Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        availableFolders={folders}
      />
    </div>
  );
};
```

---

## PART 4: Installation Steps

```bash
# 1. Copy config file
cp src/config/api-config.ts.example src/config/api-config.ts

# 2. Update with your URLs
nano src/config/api-config.ts

# 3. Add ExportModal component
cp src/components/ExportModal.tsx.new src/components/ExportModal.tsx

# 4. Update environment
nano .env.local

# 5. Install dependencies (if needed)
npm install

# 6. Build and test
npm run dev

# 7. Test export button
# - Click "Export Context"
# - Select folders
# - Click "Create MCP Export"
# - Check "Manage Servers" tab for status
```

---

## PART 5: Testing

```typescript
// Test API connection
async function testExport() {
  const response = await fetch(
    `${import.meta.env.VITE_API_GATEWAY_URL}/health`
  );
  const data = await response.json();
  console.log('Gateway status:', data);
}

// Test export creation
async function testCreateExport() {
  const response = await fetch(
    `${import.meta.env.VITE_API_GATEWAY_URL}/export`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folders: ['/Arsenal'],
        format: 'markdown',
      }),
    }
  );
  const data = await response.json();
  console.log('Export created:', data);
}
```

---

## ✅ ПЕРЕВІРКА

Перед deploy:
- ✅ `.env.local` налаштовано з правильними URL
- ✅ Cloudflare Worker розгорнутий і доступний
- ✅ n8n вебхук налаштований
- ✅ Supabase з'єднання активне
- ✅ ExportModal компонент імпортований
- ✅ Button для відкриття модалі доданий
- ✅ API endpoints тестовані

