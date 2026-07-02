import { useState, useRef } from 'react'
import { validateImageFile } from '../../services/imageService'

interface ImageUploadProps {
  currentUrl?: string
  defaultEmoji?: string
  onUpload: (file: File) => Promise<void>
  disabled?: boolean
  shape?: 'circle' | 'square'
  size?: number
}

export function ImageUpload({
  currentUrl,
  defaultEmoji = '📷',
  onUpload,
  disabled = false,
  shape = 'square',
  size = 80
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    const valError = validateImageFile(file)
    if (valError) {
      setError(valError)
      return
    }

    setUploading(true)
    try {
      await onUpload(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const borderRadius = shape === 'circle' ? '50%' : '14px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius,
          background: 'rgba(255,255,255,0.06)',
          border: '1.5px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          cursor: disabled || uploading ? 'not-allowed' : 'pointer',
          flexShrink: 0
        }}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        title={disabled ? undefined : "Click to upload image"}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: size * 0.4 }}>{defaultEmoji}</span>
        )}
        
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div className="team-spinner" />
          </div>
        )}
        
        {!disabled && !uploading && (
          <div className="image-upload-overlay" style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s',
            color: '#fff', fontSize: 12, fontWeight: 'bold'
          }}>
            Upload
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png, image/webp, image/gif, image/svg+xml"
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />
      
      {error && <span style={{ color: '#f87171', fontSize: 11, textAlign: 'center', maxWidth: 120 }}>{error}</span>}
      <style>{`
        .image-upload-overlay:hover { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
