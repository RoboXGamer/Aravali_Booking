import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { UserPlus } from 'lucide-react';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'admin'
        }
      }
    });

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-8 bg-cinema-card">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-brand/10 text-brand items-center justify-center mb-4">
            <UserPlus className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Create Profile</h2>
          <p className="text-sm text-slate-400 mt-1.5">Create your account to start reserving seats.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <Input 
            label="Full Name" 
            type="text" 
            placeholder="Aravalli Operator"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
          />
          <Input 
            label="Email Address" 
            type="email" 
            placeholder="attendee@gmail.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="Min 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-xs text-rose-500 bg-rose-950/20 border border-rose-950/40 p-3 rounded-lg">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Register Profile'}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Registered already? <Link to="/login" className="text-brand hover:underline font-medium">Sign In</Link>
        </p>
      </Card>
    </div>
  );
};
