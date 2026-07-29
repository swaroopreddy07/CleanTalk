import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Link, Alert, InputAdornment, IconButton, CircularProgress } from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle, Cancel } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const passwordRules = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
  { label: 'One symbol (!@#$...)', test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  // Step 1: Email + Username → Send OTP
  // Step 2: Enter OTP → Verify
  // Step 3: Set Password → Register
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({ email: '', username: '', password: '', confirmPassword: '', otp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Step 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault(); setError('');
    if (!formData.email || !formData.username) { setError('Email and username are required'); return; }
    if (formData.username.length < 3) { setError('Username must be at least 3 characters'); return; }
    setLoading(true);
    try {
      await authAPI.sendOTP({ email: formData.email, username: formData.username });
      setOtpSent(true); setStep(2);
      startResendTimer();
    } catch (err) { setError(err.response?.data?.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault(); setError('');
    if (!formData.otp || formData.otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      await authAPI.verifyOTP({ email: formData.email, otp: formData.otp });
      setStep(3);
    } catch (err) { setError(err.response?.data?.message || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  // Step 3: Complete registration
  const handleRegister = async (e) => {
    e.preventDefault(); setError('');
    const allPassed = passwordRules.every(r => r.test(formData.password));
    if (!allPassed) { setError('Password does not meet all requirements'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await register({ email: formData.email, username: formData.username, password: formData.password });
      navigate('/');
    } catch (err) { setError(err.response?.data?.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOTP = async () => {
    setError(''); setLoading(true);
    try {
      await authAPI.sendOTP({ email: formData.email, username: formData.username });
      startResendTimer();
    } catch (err) { setError(err.response?.data?.message || 'Failed to resend OTP'); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#000', px: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 350, border: '1px solid #262626', borderRadius: 1, p: 5, mb: 1.5, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 800, mb: 1, letterSpacing: '-0.5px' }}>
          CleanTalk
        </Typography>
        <Typography variant="body2" sx={{ color: '#A8A8A8', mb: 3 }}>
          {step === 1 && 'Sign up to connect with friends safely.'}
          {step === 2 && 'Enter the OTP sent to your email.'}
          {step === 3 && 'Create a secure password.'}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 1, textAlign: 'left' }}>{error}</Alert>}

        {/* Step 1: Email & Username */}
        {step === 1 && (
          <Box component="form" onSubmit={handleSendOTP}>
            <TextField fullWidth size="small" placeholder="Email" type="email" required value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} sx={{ mb: 1 }} />
            <TextField fullWidth size="small" placeholder="Username" required value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })} sx={{ mb: 2 }} />
            <Button type="submit" fullWidth variant="contained" disabled={loading}
              sx={{ py: 1, borderRadius: 2, fontWeight: 600, fontSize: '0.875rem' }}>
              {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Send OTP'}
            </Button>
          </Box>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <Box component="form" onSubmit={handleVerifyOTP}>
            <Typography variant="body2" sx={{ color: '#F5F5F5', mb: 1 }}>
              We sent a 6-digit code to <strong>{formData.email}</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: '#A8A8A8', mb: 2, display: 'block' }}>
              📩 Didn't receive it? Please check your <strong style={{ color: '#F5F5F5' }}>Spam / Junk</strong> folder.
            </Typography>
            <TextField fullWidth size="small" placeholder="Enter 6-digit OTP" required value={formData.otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setFormData({ ...formData, otp: val });
              }}
              inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: '8px', fontSize: '1.2rem', fontWeight: 700 } }}
              sx={{ mb: 2 }} />
            <Button type="submit" fullWidth variant="contained" disabled={loading}
              sx={{ py: 1, borderRadius: 2, fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Verify OTP'}
            </Button>
            <Box>
              {resendTimer > 0 ? (
                <Typography variant="caption" sx={{ color: '#A8A8A8' }}>Resend OTP in {resendTimer}s</Typography>
              ) : (
                <Typography variant="caption" sx={{ color: '#0095F6', cursor: 'pointer', fontWeight: 600 }} onClick={handleResendOTP}>
                  Resend OTP
                </Typography>
              )}
            </Box>
            <Typography variant="caption" sx={{ color: '#A8A8A8', cursor: 'pointer', display: 'block', mt: 1 }}
              onClick={() => { setStep(1); setError(''); }}>
              ← Change email
            </Typography>
          </Box>
        )}

        {/* Step 3: Password */}
        {step === 3 && (
          <Box component="form" onSubmit={handleRegister}>
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
              }} sx={{ mb: 1 }} />

            {/* Password strength indicators */}
            {formData.password && (
              <Box sx={{ mb: 1.5, textAlign: 'left' }}>
                {passwordRules.map((rule, i) => {
                  const passed = rule.test(formData.password);
                  return (
                    <Box key={i} display="flex" alignItems="center" gap={0.5} sx={{ mb: 0.3 }}>
                      {passed ? <CheckCircle sx={{ fontSize: 14, color: '#4ade80' }} /> : <Cancel sx={{ fontSize: 14, color: '#A8A8A8' }} />}
                      <Typography variant="caption" sx={{ color: passed ? '#4ade80' : '#A8A8A8' }}>{rule.label}</Typography>
                    </Box>
                  );
                })}
              </Box>
            )}

            <TextField fullWidth size="small" placeholder="Confirm Password" type="password" required value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              error={formData.confirmPassword && formData.password !== formData.confirmPassword}
              helperText={formData.confirmPassword && formData.password !== formData.confirmPassword ? 'Passwords do not match' : ''}
              sx={{ mb: 2 }} />

            <Button type="submit" fullWidth variant="contained"
              disabled={loading || !passwordRules.every(r => r.test(formData.password)) || formData.password !== formData.confirmPassword}
              sx={{ py: 1, borderRadius: 2, fontWeight: 600, fontSize: '0.875rem' }}>
              {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Sign up'}
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ width: '100%', maxWidth: 350, border: '1px solid #262626', borderRadius: 1, py: 2.5, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#F5F5F5' }}>
          Have an account?{' '}
          <Link onClick={() => navigate('/login')} sx={{ color: '#0095F6', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>
            Log in
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Register;