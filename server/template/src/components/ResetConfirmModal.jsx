import ConfirmModal from './ConfirmModal.jsx'

export default function ResetConfirmModal({ onConfirm, onCancel }) {
  return (
    <ConfirmModal
      title="Reset to default?"
      message={
        <>
          This will permanently delete <strong className="text-zinc-700">all sections, cards, and bio data</strong>.
          Your bento will be reset to a blank state. This action cannot be undone.
        </>
      }
      confirmLabel="Reset Everything"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
