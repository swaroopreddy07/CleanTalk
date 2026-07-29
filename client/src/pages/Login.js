import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Link, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(formData.email, formData.password); navigate('/'); }
    catch (err) { setError(err.response?.data?.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#000', px: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 350, border: '1px solid #262626', borderRadius: 1, p: 5, mb: 1.5, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 1, letterSpacing: '-0.5px' }}>
          CleanTalk
        </Typography>
        <Typography variant="body2" sx={{ color: '#A8A8A8', mb: 4 }}>
          AI-Powered Safe Social Networking
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField fullWidth size="small" placeholder="Email" type="email" required value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            sx={{ mb: 1 }} />
          <TextField fullWidth size="small" placeholder="Password" type={showPassword ? 'text' : 'password'} required value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} size="small" sx={{ color: '#A8A8A8' }}>
                    {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }} />
          <Button type="submit" fullWidth variant="contained" disabled={loading}
            sx={{ py: 1, borderRadius: 2, fontWeight: 600, fontSize: '0.875rem' }}>
            {loading ? 'Logging in...' : 'Log In'}
          </Button>
        </Box>
      </Box>

      <Box sx={{ width: '100%', maxWidth: 350, border: '1px solid #262626', borderRadius: 1, py: 2.5, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#F5F5F5' }}>
          Don't have an account?{' '}
          <Link onClick={() => navigate('/register')} sx={{ color: '#0095F6', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>
            Sign up
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;