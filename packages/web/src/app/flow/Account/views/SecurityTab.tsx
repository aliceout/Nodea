import { useNavigate } from 'react-router-dom';

import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import Button from '@/ui/atoms/dirk/Button';

import DescribedSection from '../components/DescribedSection';
import { modeLabel } from '../lib/security-mode';

/** « Sécurité » tab — five rows that link to the dedicated auth
 *  pages for recovery code, password rotation, TOTP enrol, passkey
 *  management, and security mode picker. Order leads with the
 *  « must-have safety net » (recovery code) so a fresh user is
 *  nudged to set it before doing anything else, then « always there »
 *  (password) → « extra factors » (TOTP, passkey) → « how factors
 *  combine » (security mode). Stateless on its own; each link
 *  target owns its own flow. */
export default function SecurityTab() {
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const recoveryCodeSet = user?.recoveryCodeSet === true;
  const passkeysCount = user?.passkeysCount ?? 0;
  const totpEnabled = user?.totpEnabled === true;

  return (
    <div className="max-w-[880px] divide-y divide-hair">
      <DescribedSection
        title="Code de récupération"
        description={
          recoveryCodeSet
            ? 'Un code de 12 mots BIP39 te permet de récupérer ton compte si tu oublies ton mot de passe — sans perdre tes données. Régénérer invalide immédiatement l’ancien code.'
            : 'Sans ce code, oublier ton mot de passe = perte de toutes tes données. 12 mots BIP39 à noter une seule fois ; tu pourras récupérer ton compte avec, sans détruire tes entrées.'
        }
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/recovery-code')}>
          {recoveryCodeSet ? 'Régénérer' : 'Configurer'}
        </Button>
      </DescribedSection>

      <DescribedSection
        title="Mot de passe"
        description="Re-dérive ta clé sur une page dédiée — la clé maîtresse est ré-enveloppée localement avant d’atteindre le serveur, sans perte de tes entrées chiffrées. L’admin ne la voit jamais."
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/change-password')}>
          Renouveler
        </Button>
      </DescribedSection>

      <DescribedSection
        title="2FA (TOTP)"
        description={
          totpEnabled
            ? (
              <>
                <span className="font-semibold text-accent-deep">
                  TOTP activé.
                </span>
                <br />
                Tu peux gérer tes codes de secours ou désactiver la 2FA depuis cet écran.
              </>
            )
            : 'Un code à six chiffres à chaque connexion, généré par une appli d’authentification (Bitwarden, Ente Auth, Aegis, Google Auth) en plus du mot de passe — une fuite ne suffit alors plus à entrer.'
        }
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/totp')}>
          {totpEnabled ? 'Gérer' : 'Activer'}
        </Button>
      </DescribedSection>

      <DescribedSection
        title="Passkey"
        description={
          passkeysCount === 0
            ? 'Une passkey (Touch ID, Face ID, Windows Hello, Yubikey, gestionnaire de mots de passe…) remplace la saisie du mot de passe à la connexion. Si elle est compatible PRF, elle déchiffre aussi tes données — sinon elle te connecte mais te demande quand même ton mot de passe.'
            : (
              <>
                <span className="font-semibold text-accent-deep">
                  {passkeysCount} passkey{passkeysCount > 1 ? 's' : ''} enregistrée{passkeysCount > 1 ? 's' : ''}.
                </span>
                <br />
                Tu peux en ajouter d’autres ou retirer celles que tu n’utilises plus.
              </>
            )
        }
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/passkeys')}>
          {passkeysCount === 0 ? 'Ajouter' : 'Gérer'}
        </Button>
      </DescribedSection>

      <DescribedSection
        title="Mode de sécurité"
        description={
          'Combien de facteurs sont demandés à chaque connexion (mot de passe, TOTP, passkey). Mode actuel : ' +
          modeLabel(user?.securityMode ?? 'password_or_passkey') +
          '.'
        }
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/security-mode')}>
          Modifier
        </Button>
      </DescribedSection>
    </div>
  );
}
