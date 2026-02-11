import { useState, useEffect } from 'react';
import { QrCode, Save, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { PixConfig } from '@/types';

// Função para gerar payload PIX estático (BR Code)
function generatePixPayload(config: PixConfig, valor?: number): string {
  const formatField = (id: string, value: string) => {
    return `${id}${value.length.toString().padStart(2, '0')}${value}`;
  };

  // Merchant Account Information
  const gui = formatField('00', 'BR.GOV.BCB.PIX');
  const chave = formatField('01', config.chave);
  const merchantAccountInfo = formatField('26', gui + chave);

  // Transaction Amount (optional)
  const transactionAmount = valor ? formatField('54', valor.toFixed(2)) : '';

  // Merchant Category Code
  const mcc = formatField('52', '0000');

  // Transaction Currency (BRL = 986)
  const currency = formatField('53', '986');

  // Country Code
  const countryCode = formatField('58', 'BR');

  // Merchant Name
  const merchantName = formatField('59', config.nome_beneficiario.substring(0, 25));

  // Merchant City
  const merchantCity = formatField('60', config.cidade.substring(0, 15));

  // Additional Data Field Template
  const txid = formatField('05', '***');
  const additionalData = formatField('62', txid);

  // Payload Format Indicator
  const payloadFormatIndicator = formatField('00', '01');

  // Build payload without CRC
  let payload = payloadFormatIndicator + merchantAccountInfo + mcc + currency + transactionAmount + countryCode + merchantName + merchantCity + additionalData;
  
  // Add CRC placeholder
  payload += '6304';

  // Calculate CRC16-CCITT
  const crc = calculateCRC16(payload);
  payload = payload.slice(0, -4) + formatField('63', crc);

  return payload;
}

function calculateCRC16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export function PixConfigView() {
  const [config, setConfig] = useState<PixConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [valorQr, setValorQr] = useState<string>('');
  const [formData, setFormData] = useState({
    tipo_chave: 'cpf' as PixConfig['tipo_chave'],
    chave: '',
    nome_beneficiario: '',
    cidade: 'Sao Paulo',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('pix_config')
      .select('*')
      .eq('ativo', true)
      .limit(1)
      .single();
    
    if (data) {
      setConfig(data as PixConfig);
      setFormData({
        tipo_chave: data.tipo_chave as PixConfig['tipo_chave'],
        chave: data.chave,
        nome_beneficiario: data.nome_beneficiario,
        cidade: data.cidade,
      });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!formData.chave.trim() || !formData.nome_beneficiario.trim()) {
      toast({ title: 'Chave e nome são obrigatórios', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    if (config) {
      const { error } = await supabase
        .from('pix_config')
        .update(formData)
        .eq('id', config.id);
      
      if (error) {
        toast({ title: 'Erro ao salvar', variant: 'destructive' });
      } else {
        toast({ title: 'Configurações salvas!' });
        loadConfig();
      }
    } else {
      const { error } = await supabase.from('pix_config').insert({ ...formData, ativo: true });
      
      if (error) {
        toast({ title: 'Erro ao salvar', variant: 'destructive' });
      } else {
        toast({ title: 'PIX configurado!' });
        loadConfig();
      }
    }

    setIsSaving(false);
  };

  const copyPayload = () => {
    if (!config) return;
    const valor = valorQr ? parseFloat(valorQr) : undefined;
    const payload = generatePixPayload(config, valor);
    navigator.clipboard.writeText(payload);
    toast({ title: 'Código PIX copiado!' });
  };

  const openQrGenerator = () => {
    if (!config) return;
    const valor = valorQr ? parseFloat(valorQr) : undefined;
    const payload = generatePixPayload(config, valor);
    // Usar API externa para gerar QR Code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
    window.open(qrUrl, '_blank');
  };

  if (isLoading) return <LoadingSpinner message="Carregando configurações..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Configuração PIX</h2>
      </div>

      {/* Formulário de configuração */}
      <div className="card-premium p-4 space-y-4">
        <div>
          <Label>Tipo de Chave</Label>
          <Select
            value={formData.tipo_chave}
            onValueChange={(v) => setFormData({ ...formData, tipo_chave: v as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="telefone">Telefone</SelectItem>
              <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Chave PIX *</Label>
          <Input
            value={formData.chave}
            onChange={(e) => setFormData({ ...formData, chave: e.target.value })}
            placeholder="Sua chave PIX"
          />
        </div>
        <div>
          <Label>Nome do Beneficiário *</Label>
          <Input
            value={formData.nome_beneficiario}
            onChange={(e) => setFormData({ ...formData, nome_beneficiario: e.target.value })}
            placeholder="Nome que aparecerá no PIX"
            maxLength={25}
          />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input
            value={formData.cidade}
            onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
            placeholder="Cidade"
            maxLength={15}
          />
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>

      {/* Gerador de QR Code */}
      {config && (
        <div className="card-premium p-4 space-y-4">
          <h3 className="font-semibold">Gerar QR Code</h3>
          <div>
            <Label>Valor (opcional)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={valorQr}
              onChange={(e) => setValorQr(e.target.value)}
              placeholder="Deixe vazio para valor livre"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={copyPayload}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar Código
            </Button>
            <Button onClick={openQrGenerator}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver QR Code
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            O QR Code será aberto em uma nova aba. Você pode salvá-lo ou compartilhar com clientes.
          </p>
        </div>
      )}
    </div>
  );
}