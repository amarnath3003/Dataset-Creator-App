import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getTrainingStatus } from "../services/trainingApi";
import { Activity, ArrowLeft, Loader2, AlertCircle } from "lucide-react";

export default function RunDashboard() {
  const { id } = useParams();
  const [job, setJob] = useState(null);

  useEffect(() => {
      const interval = setInterval(async ()=>{
          const status = await getTrainingStatus(id);
          setJob(status);
      }, 2000);
      return ()=>clearInterval(interval);
  }, [id]);

  if(!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <Loader2 size={48} className="text-neu-accent animate-spin mb-2" />
          <h1 className="text-3xl font-light text-neu-text tracking-tight">Initializing Engine</h1>
          <p className="text-neu-dim font-mono text-xs uppercase tracking-widest">Establishing connection to training cluster...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
          <Link
              to="/finetune/hardware"
              className="neu-btn flex items-center gap-2 px-4 py-2 text-sm text-neu-dim hover:text-neu-text rounded-xl no-underline"
          >
              <ArrowLeft size={16} />
              Exit
          </Link>

          <div className="neu-inset px-4 py-2 rounded-xl">
              <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">RUN: {id.split('-')[0] || id}</span>
          </div>
      </div>

      <div className="neu-section">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold">
            <Activity size={18} className="text-neu-dim" />
            Training Telemetry
          </h2>
          <div className={`led ${job.status === 'running' ? 'led-green animate-pulse' : job.error ? 'led-red' : 'led-on'}`}></div>
        </div>

        <div className="neu-section-body space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="neu-stat">
                  <span className="neu-stat-value text-neu-accent capitalize">{job.status}</span>
                  <span className="neu-stat-label">System Status</span>
              </div>
              <div className="neu-stat">
                  <span className="neu-stat-value">{job.progress}%</span>
                  <span className="neu-stat-label">Overall Progress</span>
              </div>
              <div className="neu-stat">
                  <span className="neu-stat-value">{job.loss !== null ? job.loss : "0.000"}</span>
                  <span className="neu-stat-label">Validation Loss</span>
              </div>
          </div>

          <div className="neu-trough p-4 rounded-xl">
            <div className="flex justify-between text-xs font-mono text-neu-dim mb-2 uppercase tracking-widest">
              <span>Training Epoch</span>
              <span>{job.progress}%</span>
            </div>
            <div className="neu-progress-track w-full">
              <div className="neu-progress-fill" style={{ width: `${job.progress}%` }}></div>
            </div>
          </div>

          <div className="neu-terminal">
            {`> Training Run Initialized [Job ID: ${id}]\n`}
            {`> Awaiting streaming logs...`}
          </div>
          
          {job.error && (
            <div className="neu-alert-warn mt-4">
                <AlertCircle size={16} />
                <span>Engine Error: {job.error}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
