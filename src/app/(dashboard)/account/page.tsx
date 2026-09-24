'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Smartphone, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AccountPage() {
  const { theme, setTheme } = useTheme();

  // Load local session state
  const [profile, setProfile] = useState({
    name: 'Creator User',
    username: 'creator_user',
    email: 'creator@example.com',
    bio: 'Digital content strategist, scaling multi-channel video content.',
  });

  useEffect(() => {
    const session = localStorage.getItem('instasage_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        setProfile((prev) => ({
          ...prev,
          name: parsed.name || prev.name,
          email: parsed.email || prev.email,
        }));
      } catch {
        // Fallback
      }
    }
  }, []);

  // Editable Profile Form State
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email);
  const [bio, setBio] = useState(profile.bio);

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
  }, [profile]);

  // Connected Platforms State
  const [platforms, setPlatforms] = useState([
    { id: 'instagram', name: 'Instagram', handle: '@creatorhandle', connected: true, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
    { id: 'youtube', name: 'YouTube', handle: 'CreatorChannel', connected: true, color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    { id: 'facebook', name: 'Facebook', handle: 'Not connected', connected: false, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ]);

  // Preferences State
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('gmt-5');
  const [dateFormat, setDateFormat] = useState('mdy');
  const [notifications, setNotifications] = useState({
    reports: true,
    insights: true,
    reminders: false,
    security: true,
  });

  // Security UI State
  const [twoFactor, setTwoFactor] = useState(false);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile({ name, username, email, bio });
    localStorage.setItem('instasage_session', JSON.stringify({ email, name }));
    toast.success('Profile Saved', { description: 'Your profile settings have been updated.' });
  };

  const togglePlatform = (id: string) => {
    setPlatforms((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nextConnected = !p.connected;
          toast.success(
            nextConnected
              ? `${p.name} connected successfully!`
              : `${p.name} disconnected.`
          );
          return {
            ...p,
            connected: nextConnected,
            handle: nextConnected ? '@newcreator_handle' : 'Not connected',
          };
        }
        return p;
      })
    );
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !newPassword) {
      toast.error('Field Validation Error', { description: 'Please fill in both password fields.' });
      return;
    }
    toast.success('Password Updated', { description: 'Your account security credentials have been updated.' });
    setPassword('');
    setNewPassword('');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-4 bg-secondary/10 p-5 rounded-xl border border-border">
        <Avatar className="h-14 w-14 border border-border">
          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-lg font-bold">
            {profile.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">{profile.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">@{profile.username} · {profile.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid grid-cols-5 bg-secondary/40 border border-border h-9 text-xs mb-6">
          <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
          <TabsTrigger value="platforms" className="text-xs">Platforms</TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs">Preferences</TabsTrigger>
          <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
          <TabsTrigger value="billing" className="text-xs">Usage & Plan</TabsTrigger>
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile">
          <Card className="bg-secondary/20 border-border">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">Profile Settings</CardTitle>
              <CardDescription className="text-[11px]">Update your public creator profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Full Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs bg-secondary/50 border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Username</Label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-8 text-xs bg-secondary/50 border-border" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Email Address</Label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs bg-secondary/50 border-border" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Bio</Label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-border bg-secondary/50 p-2.5 text-xs text-foreground focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLATFORMS TAB */}
        <TabsContent value="platforms">
          <Card className="bg-secondary/20 border-border">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">Connected Platforms</CardTitle>
              <CardDescription className="text-[11px]">Authorized social platform connections for analytical access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              {platforms.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/15">
                  <div className="flex items-center gap-3">
                    <Badge className={`text-[10px] border px-2 py-0.5 ${p.color}`}>{p.name}</Badge>
                    <span className="text-xs text-muted-foreground font-medium">{p.handle}</span>
                  </div>
                  <Button
                    variant={p.connected ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => togglePlatform(p.id)}
                    className="text-xs h-7.5 px-3"
                  >
                    {p.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREFERENCES TAB */}
        <TabsContent value="preferences">
          <Card className="bg-secondary/20 border-border">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">Preferences</CardTitle>
              <CardDescription className="text-[11px]">Tailor the application interface to your locale settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-4">
                {/* Theme Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Theme Mode</Label>
                  <Select value={theme} onValueChange={(val) => { setTheme(val); toast.success(`Theme updated to ${val}`); }}>
                    <SelectTrigger className="h-8 text-xs bg-secondary/50 border-border">
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark" className="text-xs">Dark Mode</SelectItem>
                      <SelectItem value="light" className="text-xs">Light Mode</SelectItem>
                      <SelectItem value="system" className="text-xs">System Default</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Language Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Interface Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-8 text-xs bg-secondary/50 border-border">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en" className="text-xs">English (US)</SelectItem>
                      <SelectItem value="es" className="text-xs">Español</SelectItem>
                      <SelectItem value="fr" className="text-xs">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Timezone Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="h-8 text-xs bg-secondary/50 border-border">
                      <SelectValue placeholder="Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmt-5" className="text-xs">GMT-5 (EST)</SelectItem>
                      <SelectItem value="gmt-0" className="text-xs">GMT+0 (UTC)</SelectItem>
                      <SelectItem value="gmt+5.5" className="text-xs">GMT+5:30 (IST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Format */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Format</Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger className="h-8 text-xs bg-secondary/50 border-border">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mdy" className="text-xs">MM/DD/YYYY</SelectItem>
                      <SelectItem value="dmy" className="text-xs">DD/MM/YYYY</SelectItem>
                      <SelectItem value="ymd" className="text-xs">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="border-border/50 my-2" />

              {/* Notification Preferences */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Email Notifications</h3>
                {[
                  { key: 'reports' as const, label: 'Weekly Summary Reports', desc: 'Get automated weekly summary charts in your inbox.' },
                  { key: 'insights' as const, label: 'Real-time AI Insights', desc: 'Be notified the moment a high impact performance trend is indexed.' },
                  { key: 'reminders' as const, label: 'Optimal Posting Reminders', desc: 'Alerts when your peak engagement posting window opens.' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-foreground">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={(checked) => {
                        setNotifications((p) => ({ ...p, [item.key]: checked }));
                        toast.success(`${item.label} updated.`);
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY TAB */}
        <TabsContent value="security">
          <Card className="bg-secondary/20 border-border">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">Security Settings</CardTitle>
              <CardDescription className="text-[11px]">Manage password credentials and active browser sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-3">
              {/* Password update form */}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Current Password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 bg-secondary/50 border-border text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">New Password</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-8 bg-secondary/50 border-border text-xs" />
                  </div>
                </div>
                <Button type="submit" size="sm" className="text-xs h-8">Update Password</Button>
              </form>

              <Separator className="border-border/50" />

              {/* 2FA (UI Only) */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/15">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    Two-Factor Authentication (2FA)
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Secure your creator workspace with mobile authenticator codes.</p>
                </div>
                <Switch checked={twoFactor} onCheckedChange={(val) => { setTwoFactor(val); toast.success(`2FA ${val ? 'Activated' : 'Deactivated'}`); }} />
              </div>

              {/* Active Sessions (Mock) */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Active Device Sessions</h3>
                {[
                  { device: 'macOS (Safari browser)', location: 'New York, USA', status: 'Current Session', icon: Monitor, current: true },
                  { device: 'iOS Device (Safari Mobile)', location: 'Boston, USA', status: 'Active 2 hours ago', icon: Smartphone, current: false },
                ].map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border border-border bg-secondary/15 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-indigo-500/10 text-indigo-400">
                        <session.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{session.device}</p>
                        <p className="text-[10px] text-muted-foreground">{session.location} · {session.status}</p>
                      </div>
                    </div>
                    {!session.current && (
                      <Button variant="ghost" size="sm" onClick={() => toast.success('Device session revoked.')} className="text-xs text-red-400 hover:text-red-300">
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILLING & PLAN TAB */}
        <TabsContent value="billing">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subscription */}
            <Card className="bg-secondary/20 border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Subscription Plan</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">Current Plan</p>
                    <p className="text-[10px] text-muted-foreground">Pro Creator Workspace</p>
                  </div>
                  <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">Active</Badge>
                </div>
                <div className="text-xs space-y-2 border-t border-border/50 pt-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Member Since</span>
                    <span className="text-foreground">June 1, 2024</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Last Login Session</span>
                    <span className="text-foreground">Today, 08:42 AM</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage */}
            <Card className="bg-secondary/20 border-border">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Usage Limits</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2.5">
                  <UsageItem label="Connected Accounts" value={2} limit={5} />
                  <UsageItem label="Posts Analyzed" value={142} limit={500} />
                  <UsageItem label="AI Audit Requests" value={84} limit={200} />
                  <UsageItem label="Reports Generated" value={12} limit={25} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsageItem({ label, value, limit }: { label: string; value: number; limit: number }) {
  const percentage = Math.min((value / limit) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-semibold">{value} / {limit}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-secondary/50 overflow-hidden">
        <div className="h-full bg-indigo-500" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
