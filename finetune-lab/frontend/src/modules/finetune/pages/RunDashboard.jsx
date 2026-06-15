import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getTrainingStatus } from "../services/trainingApi";

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

  if(!job) return <div className="text-xl font-medium animate-pulse">Loading Training Run...</div>

  return (

    <div className="space-y-6">

      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Training Run Dashboard</h1>
        <p className="text-neu-muted">Job ID: <span className="font-mono text-sm">{id}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 border border-neu-border bg-neu-surface rounded-xl">
              <h3 className="text-sm font-medium text-neu-muted uppercase tracking-wider">Status</h3>
              <p className="text-2xl font-bold mt-2 capitalize">{job.status}</p>
          </div>
          <div className="p-6 border border-neu-border bg-neu-surface rounded-xl">
              <h3 className="text-sm font-medium text-neu-muted uppercase tracking-wider">Progress</h3>
              <p className="text-2xl font-bold mt-2">{job.progress}%</p>
          </div>
          <div className="p-6 border border-neu-border bg-neu-surface rounded-xl">
              <h3 className="text-sm font-medium text-neu-muted uppercase tracking-wider">Current Loss</h3>
              <p className="text-2xl font-bold mt-2">{job.loss !== null ? job.loss : "Waiting..."}</p>
          </div>
      </div>
      
      {job.error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
            Error: {job.error}
        </div>
      )}

    </div>
  )
}
