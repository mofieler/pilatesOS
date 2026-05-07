'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldIcon, CheckCircleIcon, AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signWaiverAction } from '@/modules/users/actions/waiver.action';

export default function WaiverPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [acknowledged, setAcknowledged] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const trimmedName = signedName.trim();
  const canSubmit = acknowledged && trimmedName.length >= 2;

  function handleSubmit() {
    if (!acknowledged) {
      setError('Please acknowledge the waiver to continue');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Please type your full legal name as your signature');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await signWaiverAction({
        acknowledged,
        signedName: trimmedName,
      });

      if (result.success) {
        setSuccess(true);
        // Redirect to book page after short delay
        setTimeout(() => {
          router.push('/book');
          router.refresh();
        }, 1500);
      } else {
        setError(result.error || 'Failed to sign waiver');
      }
    });
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldIcon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Liability Waiver</CardTitle>
          <CardDescription>
            Please read and acknowledge the following before booking your first class
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {success ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Waiver signed successfully! Redirecting to booking page...
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
                <h3 className="mb-3 font-semibold">Release of Liability and Assumption of Risk</h3>
                <p className="mb-3">
                  I understand that Pilates and movement classes involve physical activity that may
                  be strenuous and may cause physical injury. I am fully aware of the risks and
                  hazards involved.
                </p>
                <p className="mb-3">
                  I assume full responsibility for any and all damages, injuries, or illnesses that I
                  may sustain while participating in classes at this studio.
                </p>
                <p className="mb-3">
                  I release, waive, discharge, and covenant not to sue the studio, its instructors,
                  and staff from any and all liability, claims, demands, actions, and causes of
                  action whatsoever arising out of or related to any loss, damage, or injury,
                  including death, that may be sustained by me.
                </p>
                <p>
                  I have read the foregoing and understand that it is a release of liability and a
                  contract. I sign it voluntarily and with full knowledge of its significance.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                  disabled={isPending}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="acknowledge"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I acknowledge and agree to the above Liability Waiver
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Required before you can book your first class
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signedName" className="text-sm font-medium">
                  Type your full legal name as your signature
                </Label>
                <Input
                  id="signedName"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  disabled={isPending}
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
                <p className="text-xs text-muted-foreground">
                  By typing your name above and clicking Sign Waiver below, you
                  consent to using an electronic signature with the same legal
                  effect as a handwritten signature.
                </p>
              </div>
            </>
          )}
        </CardContent>

        {!success && (
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className="w-full"
            >
              {isPending ? 'Processing...' : 'Sign Waiver & Continue'}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
