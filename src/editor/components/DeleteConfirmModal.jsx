import ConfirmModal from './ConfirmModal.jsx'

export default function DeleteConfirmModal({ sectionTitle, onConfirm, onCancel }) {
  return (
    <ConfirmModal
      title="Delete section?"
      message={
        <>
          This will permanently delete <strong className="text-zinc-700">"{sectionTitle || 'Untitled Section'}"</strong> and
          all cards inside it. This action cannot be undone.
        </>
      }
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
