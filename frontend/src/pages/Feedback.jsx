import { useEffect, useState } from 'react'
import { useParams } from 'react'
import { whatsappService } from '@/services/whatsapp'

export default function Feedback() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    whatsappService
      .getPublicFeedback(token)
      .then((res) => {
        setData(res)
        if (res.submitted_at) {
          setSubmitted(true)
        }
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'This feedback link is invalid or has expired.')
      })
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitting(true)
    whatsappService
      .submitPublicFeedback(token, { rating, comment })
      .then((res) => {
        setData(res)
        setSubmitted(true)
      })
      .catch((err) => {
        alert(err.response?.data?.detail || 'Failed to submit feedback.')
      })
      .finally(() => setSubmitting(false))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <span className="text-5xl mb-4 block">⚠️</span>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Invalid</h2>
          <p className="text-slate-600 mb-6">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100/50">
        {/* Header Banner */}
        <div className="bg-emerald-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
            <span className="text-3xl">🍽️</span>
          </div>
          <h1 className="text-2xl font-black tracking-wide">{data.restaurant_name}</h1>
          <p className="text-emerald-100 text-sm mt-1">Customer Experience Feedback</p>
        </div>

        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <span className="text-4xl">🌟</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h2>
              <p className="text-slate-600 mb-4">
                Your rating <span className="font-bold text-emerald-600">{data.rating || rating} ★</span> has been recorded.
              </p>
              {data.comment && (
                <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-200 text-slate-700 italic mb-4">
                  "{data.comment}"
                </div>
              )}
              <p className="text-xs text-slate-400">Your feedback helps us improve our service!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Customer Name</p>
                  <p className="font-semibold text-slate-800">{data.customer_name}</p>
                </div>
                {data.bill_number && (
                  <div className="text-right">
                    <p className="text-slate-500 text-xs">Bill No.</p>
                    <p className="font-semibold text-slate-800">{data.bill_number}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-center font-bold text-slate-800 text-lg mb-3">
                  How was the food and service?
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-4xl transition-all duration-200 transform hover:scale-125 focus:outline-none ${
                        star <= rating ? 'scale-110 drop-shadow-md' : 'opacity-30 grayscale'
                      }`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <div className="text-center mt-2 font-medium text-emerald-600 text-sm">
                  {rating === 5 && 'Excellent! 😋'}
                  {rating === 4 && 'Good! 😊'}
                  {rating === 3 && 'Average 🙂'}
                  {rating === 2 && 'Below Average 🙁'}
                  {rating === 1 && 'Poor Experience 😠'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Any comments or suggestions? (Optional)
                </label>
                <textarea
                  rows="3"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience..."
                  className="w-full rounded-2xl border-slate-200 border p-3.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none transition"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-600/30 transition duration-150 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Rating 🚀</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
